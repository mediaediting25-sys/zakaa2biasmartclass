import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const getPublicPlatform = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Platform configuration unavailable");
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const [plans, settings, news] = await Promise.all([
    client.from("platform_plan_overrides").select("id,price_egp,price_sar,price_usd,name_ar,name_en,features_ar,features_en"),
    client.from("platform_settings").select("announcement_ar,announcement_en").eq("id", "public").maybeSingle(),
    client.from("platform_news").select("id,title_ar,title_en,body_ar,body_en,category,created_at").eq("published", true).order("created_at", { ascending: false }).limit(50),
  ]);
  if (plans.error || settings.error || news.error) throw new Error("Unable to load platform content");
  return { plans: plans.data ?? [], settings: settings.data, news: news.data ?? [] };
});