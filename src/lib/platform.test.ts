import { expect, it } from "vitest";
import { annualPrice } from "./platform";
import { PLANS } from "./plans";

it("keeps the current individual teacher prices until the owner changes them", () => {
  expect(PLANS.find(p => p.id === "pro")?.price).toEqual({ egp: 290, sar: 79, usd: 21 });
});
it("charges ten monthly payments for a year with two months free", () => {
  expect(annualPrice(290)).toBe(2900);
  expect(annualPrice(79)).toBe(790);
  expect(annualPrice(21)).toBe(210);
});