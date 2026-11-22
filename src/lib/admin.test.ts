import { expect, it } from "vitest";
import { administrativePermissions, canManageBlock, canManageRoles, canUseAdminSection } from "./admin";
it("gives general administration access to all eight sections", () => {
  expect(administrativePermissions).toHaveLength(8);
  for (const permission of administrativePermissions) expect(canUseAdminSection(false, ["general_admin"], permission)).toBe(true);
});
it("general administrators still cannot change or block other administrators", () => {
  expect(canManageRoles(false, { is_owner: false, roles: ["admin"] }, "teacher")).toBe(false);
  expect(canManageBlock(false, "general", { user_id: "other", is_owner: false, roles: ["admin"] })).toBe(false);
});
it("allows the owner to access every administrative section without grants", () => {
  for (const permission of administrativePermissions) expect(canUseAdminSection(true, [], permission)).toBe(true);
});
it("separates news administration from pricing and user administration", () => {
  expect(canUseAdminSection(false, ["news"], "news")).toBe(true);
  expect(canUseAdminSection(false, ["news"], "pricing")).toBe(false);
  expect(canUseAdminSection(false, ["news"], "users")).toBe(false);
});
it("does not give an administrator any section by default", () => {
  for (const permission of administrativePermissions) expect(canUseAdminSection(false, [], permission)).toBe(false);
});
it("grants subjects separately and removes access when the grant is revoked", () => {
  expect(canUseAdminSection(false, ["subjects"], "subjects")).toBe(true);
  expect(canUseAdminSection(false, ["subjects"], "pricing")).toBe(false);
  expect(canUseAdminSection(false, ["pricing"], "subjects")).toBe(false);
  expect(canUseAdminSection(false, [], "subjects")).toBe(false);
});
it("protects the owner's roles from all administrators", () => {
  expect(canManageRoles(true, { is_owner: true, roles: ["admin"] }, "admin")).toBe(false);
  expect(canManageRoles(false, { is_owner: true, roles: ["admin"] }, "teacher")).toBe(false);
});
it("only the owner may appoint or manage administrators", () => {
  expect(canManageRoles(false, { is_owner: false, roles: ["student"] }, "admin")).toBe(false);
  expect(canManageRoles(false, { is_owner: false, roles: ["admin"] }, "teacher")).toBe(false);
  expect(canManageRoles(true, { is_owner: false, roles: ["student"] }, "admin")).toBe(true);
});
it("never allows the platform owner to be blocked", () => {
  expect(canManageBlock(true, "owner", { user_id: "owner", is_owner: true, roles: ["admin"] })).toBe(false);
  expect(canManageBlock(false, "admin", { user_id: "owner", is_owner: true, roles: ["admin"] })).toBe(false);
});
it("prevents administrators from blocking themselves or other administrators", () => {
  expect(canManageBlock(false, "admin-1", { user_id: "admin-1", is_owner: false, roles: ["admin"] })).toBe(false);
  expect(canManageBlock(false, "admin-1", { user_id: "admin-2", is_owner: false, roles: ["admin"] })).toBe(false);
});
it("allows administrators to block students and the owner to manage administrators", () => {
  expect(canManageBlock(false, "admin", { user_id: "student", is_owner: false, roles: ["student"] })).toBe(true);
  expect(canManageBlock(true, "owner", { user_id: "admin", is_owner: false, roles: ["admin"] })).toBe(true);
});