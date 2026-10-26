import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import { forPractice } from "../src/tenant";

let a: { id: string };
let b: { id: string };
let leadA: { id: string };
let leadB: { id: string };

function lead(practiceId: string, sourceLeadId: string) {
  return { practiceId, source: "WEBSITE" as const, sourceLeadId, name: "Test Patient", message: "Invisalign price?" };
}

beforeAll(async () => {
  a = await prisma.practice.create({ data: { slug: "tenancy-a", name: "Clinic A", webhookSecret: "tenancy_a" } });
  b = await prisma.practice.create({ data: { slug: "tenancy-b", name: "Clinic B", webhookSecret: "tenancy_b" } });
  leadA = await prisma.lead.create({ data: lead(a.id, "a-1") });
  leadB = await prisma.lead.create({ data: lead(b.id, "b-1") });
});

afterAll(async () => {
  await prisma.practice.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  await prisma.$disconnect();
});

describe("forPractice", () => {
  it("findMany returns only the clinic's own leads", async () => {
    const leads = await forPractice(a.id).lead.findMany();
    expect(leads.map((l) => l.id)).toEqual([leadA.id]);
  });

  it("findUnique by another clinic's lead id returns null", async () => {
    expect(await forPractice(a.id).lead.findUnique({ where: { id: leadB.id } })).toBeNull();
  });

  it("update by another clinic's lead id fails as not found and changes nothing", async () => {
    await expect(
      forPractice(a.id).lead.update({ where: { id: leadB.id }, data: { stage: "LOST" } }),
    ).rejects.toMatchObject({ code: "P2025" });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadB.id } })).stage).toBe("NEW");
  });

  it("updateMany and deleteMany cannot reach another clinic", async () => {
    expect((await forPractice(a.id).lead.updateMany({ data: { stage: "CONTACTED" } })).count).toBe(1);
    expect((await forPractice(a.id).lead.deleteMany({ where: { id: leadB.id } })).count).toBe(0);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadB.id } })).stage).toBe("NEW");
  });

  it("create ignores a forged practiceId and writes to the scoped clinic", async () => {
    const created = await forPractice(a.id).lead.create({ data: lead(b.id, "forged") });
    expect(created.practiceId).toBe(a.id);
  });

  it("update cannot move a lead to another clinic", async () => {
    const moved = await forPractice(a.id).lead.update({
      where: { id: leadA.id },
      data: { practiceId: b.id },
    });
    expect(moved.practiceId).toBe(a.id);
  });

  it("count and groupBy are scoped", async () => {
    expect(await forPractice(b.id).lead.count()).toBe(1);
    const groups = await forPractice(b.id).lead.groupBy({ by: ["stage"], _count: true });
    expect(groups).toEqual([{ stage: "NEW", _count: 1 }]);
  });
});
