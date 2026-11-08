import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function TeacherPhoto({ path, name }: { path?: string | null; name: string }) {
  const photo = useQuery({
    queryKey: ["teacher-photo", path],
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage.from("teacher-avatars").createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-secondary-foreground">
    {photo.data ? <img src={photo.data} alt={name} className="size-full object-cover" /> : <UserRound className="size-7" />}
  </span>;
}