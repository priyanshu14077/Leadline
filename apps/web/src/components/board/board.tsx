"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { DeliveryRow, LeadCard, Stage, StreamMessage } from "@leadline/shared";
import { AlarmClockIcon, ArrowDownIcon } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLiveStream, useStreamMessages } from "@/components/app/live-stream";
import { DraggableLeadCard, LeadCardView } from "@/components/board/lead-card";
import { LeadDrawer } from "@/components/board/lead-drawer";
import { STAGE_COLOR } from "@/components/board/stage";
import { RecentDeliveries } from "@/components/deliveries/recent-deliveries";
import { useNow } from "@/hooks/use-now";
import { ApiError, browserApi } from "@/lib/api";
import { BOARD_STAGES, formatElapsed, RED_MS, STAGE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const FRESH_MS = 4000;
const ROLLBACK_FLASH_MS = 1200;
const ARRIVAL_CHIP_MS = 12_000;

type Props = {
  practiceSlug: string;
  leads: LeadCard[];
  lostCount: number;
  deliveries: DeliveryRow[];
};

const EMPTY_COPY: Record<(typeof BOARD_STAGES)[number], string> = {
  NEW: "No new leads. They appear here the moment a form is submitted.",
  CONTACTED: "Leads you've rung move here.",
  CONSULT_BOOKED: "No consults booked yet.",
  TREATMENT_ACCEPTED: "No accepted treatment plans yet.",
};

/** A set of ids that each leave after `ms`. */
function useTimedIds(ms: number) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const mark = (id: string) => {
    setIds((s) => new Set(s).add(id));
    setTimeout(
      () =>
        setIds((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        }),
      ms,
    );
  };
  return [ids, mark] as const;
}

/** One polite announcement for arrivals, throttled so a burst reads as one sentence. */
function useArrivalAnnouncer() {
  const [text, setText] = useState("");
  const pending = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announce = (name: string) => {
    pending.current.push(name);
    if (timer.current) return;
    timer.current = setTimeout(() => {
      const names = pending.current;
      pending.current = [];
      timer.current = null;
      setText(names.length === 1 ? `New lead: ${names[0]}.` : `${names.length} new leads, latest ${names.at(-1)}.`);
    }, 1500);
  };
  return [text, announce] as const;
}

export function Board(props: Props) {
  const { practiceSlug } = props;
  const { degraded, status } = useLiveStream();
  // Stable id so dnd-kit's aria-describedby matches between server HTML and hydration.
  const dndId = useId();
  const [leads, setLeads] = useState(props.leads);
  // Ids dropped to Lost since the page loaded. A set, so a repeated update can't count twice.
  const [lostIds, setLostIds] = useState<Set<string>>(new Set());
  const lostCount = props.lostCount + lostIds.size;
  const [deliveries, setDeliveries] = useState(props.deliveries);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [freshLeads, markFreshLead] = useTimedIds(FRESH_MS);
  const [freshDeliveries, markFreshDelivery] = useTimedIds(FRESH_MS);
  const [rolledBack, markRolledBack] = useTimedIds(ROLLBACK_FLASH_MS);
  // Arrivals land at the bottom of New (longest wait first), so a chip points at them for a while.
  const [arrivals, markArrival] = useTimedIds(ARRIVAL_CHIP_MS);
  const [seenArrivals, setSeenArrivals] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [announcement, announceArrival] = useArrivalAnnouncer();

  // A router.refresh() after a resync hands us new server data; adopt it during render.
  const [serverLeads, setServerLeads] = useState(props.leads);
  if (props.leads !== serverLeads) {
    setServerLeads(props.leads);
    setLeads(props.leads);
    setLostIds(new Set());
    setDeliveries(props.deliveries);
  }

  /** Server state wins. A lead that became Lost leaves the board and bumps the counter once. */
  const upsert = (lead: LeadCard) => {
    if (lead.stage === "LOST") {
      setLeads((current) => {
        if (current.some((l) => l.id === lead.id)) setLostIds((s) => new Set(s).add(lead.id));
        return current.filter((l) => l.id !== lead.id);
      });
      return;
    }
    setLeads((current) =>
      current.some((l) => l.id === lead.id) ? current.map((l) => (l.id === lead.id ? lead : l)) : [lead, ...current],
    );
  };

  useStreamMessages((msg: StreamMessage) => {
    if (msg.type === "delivery.logged") {
      setDeliveries((d) => [msg.delivery, ...d.filter((x) => x.id !== msg.delivery.id)].slice(0, 30));
      markFreshDelivery(msg.delivery.id);
      return;
    }
    if (msg.type === "lead.created") {
      markFreshLead(msg.lead.id);
      markArrival(msg.lead.id);
      announceArrival(msg.lead.name);
    }
    // While a move of ours is in flight, the PATCH response is the authority for that card.
    if (!pending.has(msg.lead.id)) upsert(msg.lead);
  });

  const setPendingFor = (id: string, on: boolean) =>
    setPending((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /** Optimistic stage change; rolls back only this card if the API says no. */
  async function move(lead: LeadCard, to: Stage) {
    if (lead.stage === to) return;
    const contacts = lead.stage === "NEW" && to !== "LOST" && to !== "NEW";
    upsert({ ...lead, stage: to, firstContactedAt: lead.firstContactedAt ?? (contacts ? new Date().toISOString() : null) });
    setPendingFor(lead.id, true);
    try {
      const saved = await browserApi.moveLead(practiceSlug, lead.id, to);
      upsert(saved);
      if (to === "LOST") toast(`${lead.name} marked as lost`);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.status === 404 && err.detail === "lead not found") {
        setLeads((cur) => cur.filter((l) => l.id !== lead.id));
        toast.error(`${lead.name} no longer exists`, { description: "It was removed elsewhere. The board is up to date." });
        return;
      }
      // Restore the card as it was, unless the server already sent a newer copy.
      setLeads((cur) => {
        const current = cur.find((l) => l.id === lead.id);
        if (!current) return [lead, ...cur];
        return current.stage === to ? cur.map((l) => (l.id === lead.id ? lead : l)) : cur;
      });
      setLostIds((s) => {
        const next = new Set(s);
        next.delete(lead.id);
        return next;
      });
      markRolledBack(lead.id);
      toast.error(`Couldn't move ${lead.name}`, {
        description: err?.status === 0 ? "LeadLine can't reach the server." : err?.requestId ? `Request ${err.requestId}` : "Try again.",
        action: { label: "Retry", onClick: () => void move(lead, to) },
      });
    } finally {
      setPendingFor(lead.id, false);
    }
  }

  const sensors = useSensors(
    // A small distance lets a plain click open the lead instead of starting a drag.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press and hold to drag on touch, so a swipe across the cards still scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const nameOf = (id: string | number) => leads.find((l) => l.id === id)?.name ?? "The lead";
  const stageOf = (id: string | number | undefined) => (id ? (STAGE_LABEL[id as Stage] ?? String(id)) : "");
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)} from ${stageOf(leads.find((l) => l.id === active.id)?.stage)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over ${stageOf(over.id)}.` : `${nameOf(active.id)} is not over a stage.`,
    onDragEnd: ({ active, over }) =>
      over ? `Dropped ${nameOf(active.id)} in ${stageOf(over.id)}.` : `${nameOf(active.id)} was put back.`,
    onDragCancel: ({ active }) => `Move cancelled. ${nameOf(active.id)} was put back.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    const lead = leads.find((l) => l.id === active.id);
    const to = over?.id as Stage | undefined;
    if (lead && to) void move(lead, to);
  }

  const byStage = useMemo(() => {
    const map = new Map<Stage, LeadCard[]>(BOARD_STAGES.map((s) => [s, []]));
    for (const lead of leads) map.get(lead.stage)?.push(lead);
    for (const [stage, list] of map) {
      // New is a work queue: whoever has waited longest is on top. Other stages show the latest first.
      const dir = stage === "NEW" ? 1 : -1;
      list.sort((a, b) => dir * (Date.parse(a.receivedAt) - Date.parse(b.receivedAt)));
    }
    return map;
  }, [leads]);

  const dragging = leads.find((l) => l.id === draggingId) ?? null;
  const open = leads.find((l) => l.id === openId) ?? null;

  // Mobile: columns become full-width pages in a snapping scroller, with a stage switcher above.
  const scroller = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState(0);
  const showStage = (i: number) => {
    const col = scroller.current?.children[i] as HTMLElement | undefined;
    if (!col || !scroller.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.current.scrollTo({ left: col.offsetLeft - scroller.current.offsetLeft - 12, behavior: reduce ? "auto" : "smooth" });
    setActiveStage(i);
  };

  return (
    <div className="flex flex-1 flex-col gap-3 px-3 py-3 sm:px-4 lg:px-6 lg:py-4 xl:h-[calc(100dvh_-_5.75rem)] xl:min-h-0 xl:flex-none">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <BoardStats leads={leads} lostCount={lostCount} />
        {degraded && (
          <p role="status" className="rounded-md bg-warn-soft px-2.5 py-1.5 text-xs font-medium text-warn">
            {status === "failed" ? "Live updates stopped. Reload to see new leads." : "Reconnecting. Changes may be delayed."}
          </p>
        )}
      </div>

      <div role="tablist" aria-label="Stage" className="-mx-1 flex gap-1 overflow-x-auto px-1 md:hidden">
        {BOARD_STAGES.map((stage, i) => (
          <button
            key={stage}
            role="tab"
            type="button"
            aria-selected={activeStage === i}
            onClick={() => showStage(i)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm",
              activeStage === i ? "border-foreground bg-foreground font-medium text-background" : "bg-card text-muted-foreground",
            )}
          >
            {STAGE_LABEL[stage]}
            <span className="font-mono text-xs tabular-nums">{byStage.get(stage)!.length}</span>
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-4 xl:min-h-0 xl:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_23rem]">
        <DndContext
          id={dndId}
          sensors={sensors}
          accessibility={{ announcements, screenReaderInstructions: { draggable: "Use the Move button on each lead to change its stage." } }}
          onDragStart={(e) => setDraggingId(String(e.active.id))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          <div
            ref={scroller}
            onScroll={(e) => {
              const el = e.currentTarget;
              const first = el.children[0] as HTMLElement | undefined;
              if (first && window.matchMedia("(max-width: 767px)").matches) {
                setActiveStage(Math.round(el.scrollLeft / (first.offsetWidth + 12)));
              }
            }}
            className={cn(
              "-mx-3 flex snap-x snap-mandatory scroll-px-3 gap-3 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:scroll-px-4 sm:px-4",
              "xl:mx-0 xl:grid xl:h-full xl:min-h-0 xl:grid-cols-4 xl:grid-rows-[minmax(0,1fr)] xl:overflow-visible xl:px-0 xl:pb-0",
            )}
          >
            {BOARD_STAGES.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                count={byStage.get(stage)!.length}
                arrivals={stage === "NEW" ? byStage.get(stage)!.filter((l) => arrivals.has(l.id) && !seenArrivals.has(l.id)) : []}
                onSeen={(ids) => setSeenArrivals((s) => new Set([...s, ...ids]))}
              >
                {byStage.get(stage)!.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs leading-relaxed text-muted-foreground">{EMPTY_COPY[stage]}</p>
                ) : (
                  byStage.get(stage)!.map((lead) => (
                    <DraggableLeadCard
                      key={lead.id}
                      lead={lead}
                      flags={{ fresh: freshLeads.has(lead.id), pending: pending.has(lead.id), rolledBack: rolledBack.has(lead.id) }}
                      onOpen={() => setOpenId(lead.id)}
                      onMove={(to) => void move(lead, to)}
                    />
                  ))
                )}
              </Column>
            ))}
          </div>
          <LostZone visible={!!dragging} />
          <DragOverlay dropAnimation={null}>{dragging && <LeadCardView lead={dragging} dragging />}</DragOverlay>
        </DndContext>

        <RecentDeliveries practiceSlug={practiceSlug} deliveries={deliveries} freshIds={freshDeliveries} />
      </div>

      <LeadDrawer
        practiceSlug={practiceSlug}
        lead={open}
        onClose={() => setOpenId(null)}
        onSaved={upsert}
        onMove={(lead, to) => void move(lead, to)}
      />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

function Column({
  stage,
  count,
  arrivals,
  onSeen,
  children,
}: {
  stage: Stage;
  count: number;
  arrivals: LeadCard[];
  onSeen: (ids: string[]) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const latest = arrivals.at(-1);
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`col-${stage}`}
      className={cn(
        "flex w-[calc(100vw-2.25rem)] shrink-0 snap-start flex-col overflow-hidden rounded-xl bg-surface transition-[background-color,box-shadow] duration-150 sm:w-[19rem] xl:w-auto xl:min-h-0",
        isOver && "bg-brand-soft ring-2 ring-brand/40",
      )}
    >
      <span aria-hidden className={cn("h-[3px] shrink-0", STAGE_COLOR[stage])} />
      <header className="flex items-baseline justify-between gap-2 px-3 pt-2.5 pb-2">
        <h2 id={`col-${stage}`} className="type-label text-[0.8rem] text-foreground">
          {STAGE_LABEL[stage]}
        </h2>
        <span className="flex items-baseline gap-2">
          {stage === "NEW" && count > 1 && <span className="text-[0.7rem] text-muted-foreground">Longest wait first</span>}
          <span className="font-mono text-xs text-muted-foreground tabular-nums" aria-label={`${count} leads`}>
            {count}
          </span>
        </span>
      </header>
      <div
        className={cn(
          "flex max-h-[min(68dvh,40rem)] min-h-28 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 pt-1 xl:max-h-none",
          latest ? "pb-1" : "pb-6",
          "[mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)]",
        )}
      >
        {children}
        {latest && (
          <button
            type="button"
            onClick={() => {
              const el = document.querySelector<HTMLElement>(`[data-lead-id="${latest.id}"]`);
              onSeen(arrivals.map((l) => l.id));
              el?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
              el?.querySelector<HTMLElement>(":scope > button")?.focus({ preventScroll: true });
            }}
            className="motion-arrive sticky bottom-1 z-10 mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[0_8px_20px_-8px_oklch(0.3_0.15_263/0.6)]"
          >
            <ArrowDownIcon className="size-3.5" aria-hidden />
            {arrivals.length === 1 ? `New lead: ${latest.name}` : `${arrivals.length} new leads`}
          </button>
        )}
      </div>
    </section>
  );
}

/** Appears during a drag, pinned to the bottom of the screen so it is always in reach. */
function LostZone({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "LOST", disabled: !visible });
  return (
    <div
      ref={setNodeRef}
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 bottom-5 z-40 mx-auto flex h-14 w-[min(34rem,calc(100vw-2rem))] items-center justify-center rounded-xl border-2 border-dashed text-sm font-medium transition-[opacity,transform,background-color] duration-200",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        isOver ? "border-foreground bg-foreground text-background" : "border-muted-foreground/40 bg-card/95 text-muted-foreground shadow-lg",
      )}
    >
      Drop here to mark as lost
    </div>
  );
}

function BoardStats({ leads, lostCount }: { leads: LeadCard[]; lostCount: number }) {
  const now = useNow();
  const waiting = leads.filter((l) => l.stage === "NEW" && !l.firstContactedAt);
  const ages = now === null ? null : waiting.map((l) => now - Date.parse(l.receivedAt));
  const overdue = ages?.filter((a) => a >= RED_MS).length ?? null;
  const longest = ages?.length ? Math.max(...ages) : null;
  return (
    <dl className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:gap-x-1 sm:gap-y-2">
      <Stat label="Waiting for a first call" hint="New leads nobody has contacted yet.">
        {waiting.length}
      </Stat>
      <Stat
        label="Over 5 minutes"
        tone={overdue ? "overdue" : "plain"}
        icon={overdue ? <AlarmClockIcon className="size-4" aria-hidden /> : null}
        hint="Waiting leads past the 5-minute mark."
      >
        {overdue === null ? <Placeholder /> : overdue}
      </Stat>
      <Stat label="Longest wait" hint="The lead at the top of the New column.">
        {longest === null ? ages === null && waiting.length ? <Placeholder /> : "–" : formatElapsed(longest)}
      </Stat>
      <Stat label="Lost" hint="Leads marked as lost, all time.">
        {lostCount}
      </Stat>
    </dl>
  );
}

function Placeholder() {
  return <span aria-label="Calculating" className="inline-block h-5 w-6 rounded bg-muted align-middle motion-safe:animate-pulse" />;
}

function Stat({
  label,
  hint,
  tone = "plain",
  icon,
  children,
}: {
  label: string;
  hint: string;
  tone?: "plain" | "overdue";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      title={hint}
      className={cn(
        "flex min-w-[7.5rem] flex-col-reverse justify-end rounded-lg px-3 py-1.5",
        tone === "overdue" ? "bg-overdue-soft text-overdue" : "bg-surface",
      )}
    >
      <dt className={cn("text-xs", tone === "overdue" ? "text-overdue" : "text-muted-foreground")}>{label}</dt>
      <dd className="flex items-center gap-1.5 font-mono text-xl leading-7 font-semibold tabular-nums">
        {icon}
        {children}
      </dd>
    </div>
  );
}
