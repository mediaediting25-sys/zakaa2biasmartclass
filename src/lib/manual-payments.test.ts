import { expect, it } from "vitest";
import { manualPaymentMethods, manualPaymentDetails, whatsappSubscriptionUrl } from "./manual-payments";

it("offers only WhatsApp, InstaPay and Vodafone Cash", () => {
  expect([...manualPaymentMethods]).toEqual(["whatsapp", "instapay", "vodafone_cash"]);
});
it("uses the owner's supplied subscription receiving details", () => {
  expect(manualPaymentDetails.whatsapp).toBe("+201000779704");
  expect(manualPaymentDetails.instapay).toBe("01000779704");
  expect(manualPaymentDetails.vodafone_cash).toBe("01000779704");
});
it("does not open a contact link without a valid receiving number", () => {
  expect(whatsappSubscriptionUrl("", "test")).toBeNull();
  expect(whatsappSubscriptionUrl("https://example.com", "test")).toBeNull();
  expect(whatsappSubscriptionUrl("+20 100 000 0000", "yearly pro")).toBe("https://wa.me/201000000000?text=yearly%20pro");
});