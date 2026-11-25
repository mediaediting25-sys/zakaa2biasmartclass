export const DELETION_WARNING_VERSION = 1;

export const LEFT_COURSE_LABEL = "الطالب خرج من المادة";

type Named = { full_name: string | null; email: string | null };

/** Name shown to the teacher. A student whose profile is gone keeps the saved name plus a "left the course" label. */
export function studentDisplayName(profile: Named | undefined, departed: Named | undefined) {
  if (profile) return { name: profile.full_name || profile.email || "طالب", left: false };
  const base = departed?.full_name || departed?.email || "طالب";
  return { name: `${base} (${LEFT_COURSE_LABEL})`, left: true };
}

export function emailConfirmed(accountEmail: string, typed: string) {
  const a = accountEmail.trim().toLowerCase();
  return a.length > 0 && a === typed.trim().toLowerCase();
}
