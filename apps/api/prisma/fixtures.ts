// Shared by the seed and the traffic simulator, so both produce the same kind of lead.
import type { Treatment } from "../src/generated/prisma/enums";

// Hand-written in the voice of real enquiries; {name} is not used so texts stay generic.
export const ENQUIRIES: Record<Treatment, string[]> = {
  INVISALIGN: [
    "Hi, I'd like to know if Invisalign would work for my crowded bottom teeth. How much does it usually cost?",
    "Interested in clear aligners. I have a wedding in 8 months, is that enough time?",
    "Can you do Invisalign on a payment plan? My front teeth have shifted since I had braces as a kid.",
    "Saw your ad on Instagram. Do I need a consultation first or can I just get a price for aligners?",
    "My dentist said I have an overbite. Would Invisalign fix it or do I need proper braces?",
  ],
  IMPLANTS: [
    "I lost a molar last year and want to look at an implant. Is it very painful? I'm quite nervous about dentists.",
    "Looking for a quote for 2 implants on the upper left. I've had bone loss so not sure if I'm suitable.",
    "My dentures keep slipping and I'm fed up. Do you do all-on-4 or implant-retained dentures?",
    "Need to replace a front tooth that broke, ideally quickly as I have work events coming up. Do you do implants?",
    "How much is a single implant including the crown? Other clinics quoted me very different prices.",
  ],
  VENEERS: [
    "Thinking about veneers on my top 6 teeth. Do you do composite or porcelain, and what's the difference in price?",
    "I want a Hollywood smile but I'm worried it'll look fake. Can I see before and afters?",
    "Do veneers damage your natural teeth? I'm interested but a bit scared of the drilling.",
    "Enquiring about veneers, I have gaps and some chips. Is finance available?",
    "Hi, how long do porcelain veneers last? I'd want them done before summer.",
  ],
  WHITENING: [
    "How much is teeth whitening? Is it the trays or the in-chair one?",
    "Is whitening safe if I have sensitive teeth?",
    "Do you have any whitening offers on at the moment?",
    "Saw the TikTok, is the £199 whitening still available?",
    "Just want a price for whitening, thanks.",
  ],
  COMPOSITE_BONDING: [
    "Interested in composite bonding for 4 front teeth, they're chipped at the edges. Roughly how much?",
    "Can bonding close a small gap between my front teeth? I don't want anything permanent.",
    "How long does composite bonding take? Can it be done in one appointment?",
  ],
  OTHER: [
    "I have a really bad toothache, can someone see me today?",
    "Do you take NHS patients?",
    "What are your opening hours on Saturdays?",
  ],
};

export type CampaignSeed = {
  utmCampaign: string;
  utmSource: string;
  platform: "META" | "GOOGLE" | "TIKTOK";
  name: string;
  spendPence: number;
  treatment: Treatment;
  // Funnel rates used by the seed. tiktok_whitening is meant to look busy but unprofitable.
  bookRate: number;
  acceptRate: number;
};

export const PRACTICES: {
  slug: string;
  name: string;
  webhookSecret: string;
  leadCount: number;
  campaigns: CampaignSeed[];
}[] = [
  {
    slug: "smile-studio-london",
    name: "Smile Studio London",
    webhookSecret: "whsec_dev_smile_studio",
    leadCount: 70,
    campaigns: [
      { utmCampaign: "invisalign_autumn_leadform", utmSource: "facebook", platform: "META", name: "Invisalign – Meta lead form", spendPence: 180_000, treatment: "INVISALIGN", bookRate: 0.35, acceptRate: 0.55 },
      { utmCampaign: "implants_search_london", utmSource: "google", platform: "GOOGLE", name: "Implants – Google search", spendPence: 240_000, treatment: "IMPLANTS", bookRate: 0.42, acceptRate: 0.5 },
      { utmCampaign: "veneers_reels", utmSource: "instagram", platform: "META", name: "Veneers – Instagram Reels", spendPence: 150_000, treatment: "VENEERS", bookRate: 0.3, acceptRate: 0.45 },
      { utmCampaign: "whitening_199_offer", utmSource: "tiktok", platform: "TIKTOK", name: "£199 whitening – TikTok", spendPence: 90_000, treatment: "WHITENING", bookRate: 0.06, acceptRate: 0.4 },
    ],
  },
  {
    slug: "harley-dental-manchester",
    name: "Harley Dental Manchester",
    webhookSecret: "whsec_dev_harley_dental",
    leadCount: 25,
    campaigns: [
      { utmCampaign: "bonding_meta_mcr", utmSource: "facebook", platform: "META", name: "Composite bonding – Meta", spendPence: 60_000, treatment: "COMPOSITE_BONDING", bookRate: 0.3, acceptRate: 0.6 },
      { utmCampaign: "implants_search_mcr", utmSource: "google", platform: "GOOGLE", name: "Implants – Google search", spendPence: 110_000, treatment: "IMPLANTS", bookRate: 0.38, acceptRate: 0.5 },
    ],
  },
];

// Typical UK private prices for an accepted treatment plan, in pence.
export const TREATMENT_VALUE_PENCE: Record<Treatment, [number, number]> = {
  IMPLANTS: [250_000, 900_000],
  INVISALIGN: [280_000, 550_000],
  VENEERS: [350_000, 900_000],
  WHITENING: [19_900, 45_000],
  COMPOSITE_BONDING: [120_000, 320_000],
  OTHER: [5_000, 20_000],
};

// faker's en_GB locale borrows US/German name lists; these read as UK patients on camera.
export const FIRST_NAMES = [
  "Amelia", "Olivia", "Isla", "Ava", "Emily", "Sophie", "Grace", "Lily", "Chloe", "Ella",
  "Hannah", "Lucy", "Charlotte", "Freya", "Priya", "Aisha", "Zara", "Niamh", "Megan", "Holly",
  "Oliver", "George", "Harry", "Jack", "Charlie", "Thomas", "James", "William", "Daniel", "Arjun",
  "Mohammed", "Ryan", "Callum", "Liam", "Ben", "Sam", "Joe", "Rhys", "Adam", "Kieran",
];
export const LAST_NAMES = [
  "Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Patel", "Robinson",
  "Wright", "Thompson", "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Jackson",
  "Clarke", "Khan", "Hughes", "Edwards", "Turner", "Hill", "Cooper", "Ward", "Morris", "Bennett",
  "Shah", "Ahmed", "Murphy", "O'Brien", "Kelly", "Price", "Bailey", "Harris", "Mitchell", "Hart",
];

/** UK mobile in the 07700 900xxx range Ofcom reserves for drama, so it can never ring a real person. */
export function fakeUkMobile(n: number) {
  return `07700 900${String(n % 1000).padStart(3, "0")}`;
}
