export const managedRoles = ["admin", "teacher", "student", "parent"] as const;
export function canManageRoles(actorIsOwner: boolean, target: { is_owner: boolean; roles: string[] }, role: string) {
  return !target.is_owner && (actorIsOwner || (role !== "admin" && !target.roles.includes("admin")));
}