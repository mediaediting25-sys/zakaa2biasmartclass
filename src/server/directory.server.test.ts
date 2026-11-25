import { describe, expect, it } from "vitest";
import { hiddenTeacherIds, visibleListings } from "./directory.server";

const db = (tables: Record<string, { data?: unknown; error?: unknown }>) => ({ from: (t: string) => ({ select: () => { const r = tables[t] ?? { data: [], error: null }; return Object.assign(Promise.resolve(r), { eq: async () => r }); } }) });

describe("directory exclusion", () => {
  it("hides blocked (including mid-deletion) and departed teachers without any cleanup", async () => {
    const hidden = await hiddenTeacherIds(db({ blocked_accounts: { data: [{ user_id: "a" }] }, departed_accounts: { data: [{ user_id: "b" }] } }));
    expect(visibleListings([{ teacher_id: "a" }, { teacher_id: "b" }, { teacher_id: "c" }], hidden)).toEqual([{ teacher_id: "c" }]);
  });
  it("works before the departed table exists, but fails closed if the block list cannot be read", async () => {
    const hidden = await hiddenTeacherIds(db({ blocked_accounts: { data: [] }, departed_accounts: { error: new Error("missing") } }));
    expect(hidden.size).toBe(0);
    await expect(hiddenTeacherIds(db({ blocked_accounts: { error: new Error("x") } }))).rejects.toThrow();
  });
  it("an aborted deletion (block lifted) shows the teacher again", async () => {
    const hidden = await hiddenTeacherIds(db({ blocked_accounts: { data: [] } }));
    expect(visibleListings([{ teacher_id: "a" }], hidden)).toHaveLength(1);
  });
});
