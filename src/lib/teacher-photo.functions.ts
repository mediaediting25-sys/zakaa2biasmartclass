import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getTeacherPhotoUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: listing } = await supabaseAdmin
      .from("teacher_listings").select("teacher_id").eq("photo_path", data.path).eq("is_listed", true).maybeSingle();
    if (!listing || data.path.split("/")[0] !== listing.teacher_id) return null;
    const { data: signed } = await supabaseAdmin.storage.from("teacher-avatars").createSignedUrl(data.path, 3600);
    return signed?.signedUrl ?? null;
  });
