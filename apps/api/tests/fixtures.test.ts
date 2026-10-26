import { describe, expect, it } from "vitest";
import { fakeUkMobile, PRACTICES } from "../prisma/fixtures";

describe("fake data never reaches real people", () => {
  it("every generated phone is in Ofcom's 07700 900xxx drama range", () => {
    for (const n of [0, 7, 42, 999, 1000, 123_456]) expect(fakeUkMobile(n)).toMatch(/^07700 900\d{3}$/);
  });

  it("the seeded clinics are the two the demo and Postman use", () => {
    expect(PRACTICES.map((p) => p.slug)).toEqual(expect.arrayContaining(["smile-studio-london", "harley-dental-manchester"]));
  });
});
