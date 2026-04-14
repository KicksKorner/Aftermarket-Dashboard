import { createClient } from "@/lib/supabase/server";
import ExpensesClient from "@/components/expenses/ExpensesClient";

export default async function ExpensesPage() {
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

  return <ExpensesClient isPremium={isPremium} />;
}
