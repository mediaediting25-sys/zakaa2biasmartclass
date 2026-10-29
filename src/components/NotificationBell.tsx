import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { localizeNotification } from "@/lib/localized-messages";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

export function NotificationBell({ userId }: { userId: string }) {
  const { tr, locale } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications", userId],
    refetchInterval: 60000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, kind, link, read_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });
  const unread = (data ?? []).filter((n) => !n.read_at).length;

  async function markRead() {
    if (!unread) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  return (
    <Popover onOpenChange={(o) => o && markRead()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label={tr("الإشعارات")}>
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -end-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-h-96 overflow-auto p-2">
        {(data ?? []).length === 0 ? (
          <p className="p-3 text-center text-sm text-muted-foreground">{tr("لا توجد إشعارات")}</p>
        ) : (
          (data ?? []).map((notification) => {
            const n = { ...notification, ...localizeNotification(locale, notification.title, notification.body, notification.kind) };
            return (
            <div key={n.id} className="rounded-lg p-2 text-sm hover:bg-muted">
              <div className="font-medium">{n.title}</div>
              {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
            </div>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}
