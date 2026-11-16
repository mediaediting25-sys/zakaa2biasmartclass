import { describe, expect, it, vi } from "vitest";
import { requireTeacherAccess, TEACHER_ACCESS_EXPIRED } from "./teacher-access";

describe("teacher generation access", () => {
  it("blocks expired access before generation starts", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    await expect(requireTeacherAccess({ rpc })).rejects.toThrow(TEACHER_ACCESS_EXPIRED);
    expect(rpc).toHaveBeenCalledWith("teacher_access_active");
  });
  it("allows access when the database confirms an active period or owner exemption", async () => {
    await expect(requireTeacherAccess({ rpc: vi.fn().mockResolvedValue({ data: true, error: null }) })).resolves.toBeUndefined();
  });
  it("does not allow generation if the access check fails", async () => {
    await expect(requireTeacherAccess({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "unavailable" } }) })).rejects.toThrow("تعذر التحقق من الاشتراك");
  });
});