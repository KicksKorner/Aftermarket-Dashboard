import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const user = data.user;

      // Extract Discord identity data from OAuth metadata
      const discordIdentity = user.identities?.find(
        (id) => id.provider === "discord"
      );

      if (discordIdentity?.identity_data) {
        const discordId = discordIdentity.identity_data.provider_id as string;
        const discordUsername =
          (discordIdentity.identity_data.full_name as string) ||
          (discordIdentity.identity_data.name as string) ||
          (discordIdentity.identity_data.custom_claims?.global_name as string) ||
          null;

        // Upsert profile with discord details — create row if first login
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email,
            discord_id: discordId,
            discord_username: discordUsername,
            role: "member",
          },
          {
            onConflict: "id",
            ignoreDuplicates: false,
          }
        );

        // If profile already exists, just update the discord fields
        await supabase
          .from("profiles")
          .update({
            discord_id: discordId,
            discord_username: discordUsername,
          })
          .eq("id", user.id);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
