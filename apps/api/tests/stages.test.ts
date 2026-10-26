import { describe, expect, it } from "vitest";
import { stageTimestamps } from "../src/leads";

const NOW = new Date("2026-10-26T10:00:00Z");
const EARLIER = new Date("2026-10-20T09:00:00Z");
const fresh = { firstContactedAt: null, consultBookedAt: null, treatmentAcceptedAt: null };

describe("stageTimestamps", () => {
  it("NEW → CONTACTED stamps first contact only", () => {
    expect(stageTimestamps(fresh, "CONTACTED", NOW)).toEqual({ stage: "CONTACTED", firstContactedAt: NOW });
  });

  it("skipping NEW → CONSULT_BOOKED stamps first contact and booking", () => {
    expect(stageTimestamps(fresh, "CONSULT_BOOKED", NOW)).toEqual({
      stage: "CONSULT_BOOKED",
      firstContactedAt: NOW,
      consultBookedAt: NOW,
    });
  });

  it("NEW → TREATMENT_ACCEPTED stamps all three", () => {
    expect(stageTimestamps(fresh, "TREATMENT_ACCEPTED", NOW)).toEqual({
      stage: "TREATMENT_ACCEPTED",
      firstContactedAt: NOW,
      consultBookedAt: NOW,
      treatmentAcceptedAt: NOW,
    });
  });

  it("LOST never stamps first contact (binning spam unread is not contact)", () => {
    expect(stageTimestamps(fresh, "LOST", NOW)).toEqual({ stage: "LOST" });
  });

  it("moving back to NEW keeps every earlier timestamp", () => {
    const reached = { firstContactedAt: EARLIER, consultBookedAt: EARLIER, treatmentAcceptedAt: EARLIER };
    expect(stageTimestamps(reached, "NEW", NOW)).toEqual({ stage: "NEW" });
  });

  it("re-reaching a stage never overwrites its first timestamp", () => {
    const contacted = { firstContactedAt: EARLIER, consultBookedAt: null, treatmentAcceptedAt: null };
    expect(stageTimestamps(contacted, "CONSULT_BOOKED", NOW)).toEqual({ stage: "CONSULT_BOOKED", consultBookedAt: NOW });
    const booked = { firstContactedAt: EARLIER, consultBookedAt: EARLIER, treatmentAcceptedAt: null };
    expect(stageTimestamps(booked, "CONSULT_BOOKED", NOW)).toEqual({ stage: "CONSULT_BOOKED" });
  });
});
