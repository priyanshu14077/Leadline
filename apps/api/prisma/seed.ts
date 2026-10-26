import { fakerEN_GB as faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Prisma, Stage, Treatment } from "../src/generated/prisma/client";
import { ENQUIRIES, FIRST_NAMES, LAST_NAMES, PRACTICES, TREATMENT_VALUE_PENCE, fakeUkMobile } from "./fixtures";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

// Speed-to-lead mix: ~40% under 5 min, ~35% within the hour, the rest hours later.
function contactDelayMs() {
  const r = faker.number.float();
  if (r < 0.4) return faker.number.int({ min: 1 * MIN, max: 5 * MIN });
  if (r < 0.75) return faker.number.int({ min: 5 * MIN, max: 60 * MIN });
  return faker.number.int({ min: 60 * MIN, max: 20 * 60 * MIN });
}

function sourceLeadId(source: "META_LEAD_ADS" | "GOOGLE_LEAD_FORM" | "WEBSITE") {
  if (source === "META_LEAD_ADS") return faker.string.numeric(16);
  if (source === "GOOGLE_LEAD_FORM") return `gl_${faker.string.alphanumeric(20)}`;
  return faker.string.uuid();
}

async function main() {
  faker.seed(20261026);
  await prisma.practice.deleteMany();

  const now = Date.now();

  for (const p of PRACTICES) {
    const practice = await prisma.practice.create({
      data: { slug: p.slug, name: p.name, webhookSecret: p.webhookSecret },
    });
    const campaigns = await Promise.all(
      p.campaigns.map((c) =>
        prisma.campaign.create({
          data: { practiceId: practice.id, platform: c.platform, utmCampaign: c.utmCampaign, name: c.name, spendPence: c.spendPence },
        }),
      ),
    );

    const leads: Prisma.LeadCreateManyInput[] = [];
    for (let i = 0; i < p.leadCount; i++) {
      // 1 in 8 leads is organic website traffic with no campaign.
      const organic = faker.number.float() < 0.125;
      const idx = faker.number.int({ min: 0, max: p.campaigns.length - 1 });
      const seed = organic ? null : p.campaigns[idx];
      const campaign = organic ? null : campaigns[idx];

      // 15% of campaign leads ask about something other than the ad.
      const treatment: Treatment =
        seed && faker.number.float() > 0.15
          ? seed.treatment
          : faker.helpers.arrayElement(Object.keys(ENQUIRIES) as Treatment[]);
      const source = !seed ? "WEBSITE" : seed.platform === "GOOGLE" ? "GOOGLE_LEAD_FORM" : "META_LEAD_ADS";

      const receivedAt = new Date(now - faker.number.int({ min: 2 * 60 * MIN, max: 30 * DAY }));
      const contacted = faker.number.float() < 0.88;
      const booked = contacted && faker.number.float() < (seed?.bookRate ?? 0.3);
      const accepted = booked && faker.number.float() < (seed?.acceptRate ?? 0.5);
      const lost = contacted && !booked && faker.number.float() < 0.5;

      const firstContactedAt = contacted ? new Date(receivedAt.getTime() + contactDelayMs()) : null;
      const consultBookedAt = booked ? new Date(firstContactedAt!.getTime() + faker.number.int({ min: 10 * MIN, max: 3 * DAY })) : null;
      const treatmentAcceptedAt = accepted ? new Date(consultBookedAt!.getTime() + faker.number.int({ min: 1 * DAY, max: 10 * DAY })) : null;
      const stage: Stage = accepted ? "TREATMENT_ACCEPTED" : booked ? "CONSULT_BOOKED" : lost ? "LOST" : contacted ? "CONTACTED" : "NEW";
      const [lo, hi] = TREATMENT_VALUE_PENCE[treatment];

      const first = faker.helpers.arrayElement(FIRST_NAMES);
      const last = faker.helpers.arrayElement(LAST_NAMES);
      leads.push({
        practiceId: practice.id,
        source,
        sourceLeadId: sourceLeadId(source),
        name: `${first} ${last}`,
        email: faker.internet.email({ firstName: first, lastName: last, provider: "example.com" }).toLowerCase(),
        phone: fakeUkMobile(faker.number.int(999)),
        message: faker.helpers.arrayElement(ENQUIRIES[treatment]),
        utmSource: seed?.utmSource ?? null,
        utmCampaign: seed?.utmCampaign ?? null,
        campaignId: campaign?.id ?? null,
        stage,
        receivedAt,
        firstContactedAt,
        consultBookedAt,
        treatmentAcceptedAt,
        treatmentValuePence: accepted ? Math.round(faker.number.int({ min: lo, max: hi }) / 100) * 100 : null,
      });
    }
    await prisma.lead.createMany({ data: leads });
    console.log(`${p.name}: ${campaigns.length} campaigns, ${leads.length} leads`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
