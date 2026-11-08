import { expect, it } from "vitest";
import { canManageRoles } from "./admin";
it("protects the owner's roles from all administrators", () => {
  expect(canManageRoles(true, { is_owner: true, roles: ["admin"] }, "admin")).toBe(false);
  expect(canManageRoles(false, { is_owner: true, roles: ["admin"] }, "teacher")).toBe(false);
});
it("only the owner may appoint or manage administrators", () => {
  expect(canManageRoles(false, { is_owner: false, roles: ["student"] }, "admin")).toBe(false);
  expect(canManageRoles(false, { is_owner: false, roles: ["admin"] }, "teacher")).toBe(false);
  expect(canManageRoles(true, { is_owner: false, roles: ["student"] }, "admin")).toBe(true);
});