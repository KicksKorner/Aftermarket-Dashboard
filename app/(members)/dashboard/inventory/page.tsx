import { createClient } from "@/lib/supabase/server";
import InventoryClient from "@/components/inventory/InventoryClient";

export default async function InventoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const role = profile?.role ?? "member";
  const isPremium = role === "premium" || role === "admin";

  return <InventoryClient isPremium={isPremium} />;
}
