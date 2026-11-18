export type AccessPeriod = { starts_at: string; ends_at: string; plan_id: string; isTrial?: boolean };

// Date preview only; PostgreSQL computes the authoritative saved expiry.
export function subscriptionEnd(start: string, cycle: "monthly" | "yearly") {
  const date = new Date(start);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + (cycle === "monthly" ? 1 : 12));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString();
}

export function accessStatus(periods: AccessPeriod[], now = Date.now()) {
  const active = [...periods].filter(p => Date.parse(p.starts_at) <= now && Date.parse(p.ends_at) > now).sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at))[0];
  if (active) return { status: "active" as const, period: active };
  const upcoming = [...periods].filter(p => Date.parse(p.starts_at) > now).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  if (upcoming) return { status: "upcoming" as const, period: upcoming };
  const last = [...periods].sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at))[0];
  return { status: last ? "expired" as const : "unset" as const, period: last };
}

// Presentation only: creation permission always comes from teacher_access_active.
export function teacherAccessStatus(periods: AccessPeriod[], createdAt: string | null, now = Date.now()) {
  const created = createdAt ? Date.parse(createdAt) : NaN;
  const trial: AccessPeriod[] = Number.isFinite(created) ? [{ starts_at: new Date(created).toISOString(), ends_at: new Date(created + 30 * 24 * 60 * 60 * 1000).toISOString(), plan_id: "starter", isTrial: true }] : [];
  return accessStatus([...periods, ...trial], now);
}