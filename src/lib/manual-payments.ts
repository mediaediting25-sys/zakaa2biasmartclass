export const manualPaymentMethods = ["whatsapp", "instapay", "vodafone_cash"] as const;
export type ManualPaymentMethod = typeof manualPaymentMethods[number];

// Public receiving details only. Leave unset until supplied by the owner.
export const manualPaymentDetails: Record<ManualPaymentMethod, string> = {
  whatsapp: "+201000779704",
  instapay: "01000779704",
  vodafone_cash: "01000779704",
};

export function whatsappSubscriptionUrl(number: string, message: string): string | null {
  const digits = number.replace(/[\s()+-]/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}