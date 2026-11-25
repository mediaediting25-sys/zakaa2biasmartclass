type QueryResult = { data?: unknown; error?: unknown };
type Db = { from: (table: string) => any };

/**
 * Teacher ids that must never appear in the public directory or have a photo link signed: accounts that are
 * blocked (this includes an account in the middle of deleting itself) and accounts whose deletion is committed (login gone).
 * Does not depend on any cleanup having finished. The block list failing means we cannot tell, so we fail closed;
 * the departed list may not exist yet (before its migration), which just means nobody has departed.
 */
export async function hiddenTeacherIds(db: Db): Promise<Set<string>> {
  const blocked: QueryResult = await db.from("blocked_accounts").select("user_id");
  if (blocked.error) throw new Error("Directory unavailable");
  const departed: QueryResult = await db.from("departed_accounts").select("user_id").eq("committed", true);
  const ids = [...((blocked.data ?? []) as { user_id: string }[]), ...(departed.error ? [] : ((departed.data ?? []) as { user_id: string }[]))];
  return new Set(ids.map((r) => r.user_id));
}

export function visibleListings<T extends { teacher_id: string }>(rows: T[], hidden: Set<string>): T[] {
  return rows.filter((r) => !hidden.has(r.teacher_id));
}
