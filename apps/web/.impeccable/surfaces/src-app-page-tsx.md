---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/app"]
---

# Surface: landing page `/` (Persuade) and app shell `/app/**` (Operate)

Scope: `/` is Persuade (clinic owner first, interviewer second; action = open the live demo board).
`/app/[practice]/*` is Operate (sales team; task = ring whoever has waited longest, move the card).
Decision round not served: subagent run, nobody could answer; assigned direction built unattended.

## Direction contract

THESIS: Every enquiry is signed for. LeadLine is registered post for leads: each delivery verified,
stamped once, tracked end to end, and the clock on it visible. Refuses the category default of a white
SaaS hero with a dashboard screenshot and three feature cards, and its opposite, the neon terminal.

OWN-WORLD: Registered-envelope stock: cool paper white ground, deep registered blue ink carrying whole
fields (hero field, app header rail), the envelope's crossed bands as the structural motif, postmark
black-blue ink for type, franking red reserved for overdue only. Archivo (width axis) in condensed
caps for labels and stamps, normal width for reading; Azeret Mono only for times, ids, phones.
Postmark ring = arrival stamp. Hairline perforation rules separate docket rows.

STORY: Owner sees a lead arrive, three deliveries collapse into one card, a clock start; believes no
enquiry slips or doubles; opens the live board.

FIRST VIEWPORT: Full-bleed registered-blue field split by the two crossed bands. Top-left quadrant:
wordmark + nav. Left: headline in condensed caps at ~5.5rem, one line of sub, primary white button
"Open the live board", secondary "How it works". Right quadrant: a white proof-of-delivery docket,
live: three deliveries stamped Created / Duplicate / Duplicate merge into one lead card whose timer
ticks green → amber; labelled synthetic.

FORM: registered post / proof of delivery, position 4 of 7 on the ordered list. seed:2dafe98b39848ea2

Raises (from declined challengers): one-bit desktop → a strict, total state vocabulary (each colour
and mark means one thing). Nixie counter (competitive) → fixed-width timer digits, nothing shifts.
Festival hoarding → one word big enough to win in the hero. Rubber-hose cel → one authored transition
(the arrival stamp), nothing scattered. Brine calendar → every item carries its elapsed count.
Gravity garden → each colour is one force; the legend is always true.

Signature move (app): arrival postmark + tracking history. New cards land with a postmark stamp ring;
the delivery log groups retries as one tracked item ("3 deliveries → 1 lead"); the trace page reads
as a tracking history with request and hub lanes.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
