import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const TEACHER_ACCESS_EXPIRED = "انتهت مدة التجربة أو الاشتراك. يمكنك قراءة مقرراتك وتقاريرك، وطلب التجديد لاستئناف الإنشاء والتوليد والنشر.";

// The database decides access, including protected owner exemptions.
export async function requireTeacherAccess(db: Pick<SupabaseClient<Database>, "rpc">) {
  const { data, error } = await db.rpc("teacher_access_active");
  if (error) throw new Error("تعذر التحقق من الاشتراك؛ حاول مرة أخرى.");
  if (data !== true) throw new Error(TEACHER_ACCESS_EXPIRED);
}