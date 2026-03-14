import { createClient } from "@/lib/supabase/server";
import AmazonInvitesClient from "@/components/amazon-invites-client";

export default async function LinksPage() {
  const supabase = await createClient();

  const { data: links } = await supabase
    .from("links")
    .select("*")
    .order("created_at", { ascending: false });

  return <AmazonInvitesClient products={links ?? []} />;
}