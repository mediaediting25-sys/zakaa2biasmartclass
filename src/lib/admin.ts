export const managedRoles = ["admin", "teacher", "student", "parent"] as const;
export function canManageRoles(actorIsOwner: boolean, target: { is_owner: boolean; roles: string[] }, role: string) {
  return !target.is_owner && (actorIsOwner || (role !== "admin" && !target.roles.includes("admin")));
}

export function canManageBlock(
  actorIsOwner: boolean,
  actorId: string,
  target: { user_id: string; is_owner: boolean; roles: string[] },
) {
  if (target.user_id === actorId || target.is_owner) return false;
  return actorIsOwner || !target.roles.includes("admin");
}