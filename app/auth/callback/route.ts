import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const REQUIRED_GUILD_ID = "717030342611042334";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const user = data.user;

      const discordIdentity = user.identities?.find(
        (id) => id.provider === "discord"
      );

      const providerToken = data.session?.provider_token;

      // ── Check Discord server membership ──────────────────────────────────
      if (providerToken) {
        try {
          const memberCheck = await fetch(
            `https://discord.com/api/users/@me/guilds/${REQUIRED_GUILD_ID}/member`,
            {
              headers: {
                Authorization: `Bearer ${providerToken}`,
              },
            }
          );

          if (!memberCheck.ok) {
            await supabase.auth.signOut();
            return NextResponse.redirect(`${origin}/login?error=not_member`);
          }
        } catch {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=discord_check_failed`);
        }
      } else {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=no_token`);
      }

      // ── Member confirmed — upsert profile ────────────────────────────────
      if (discordIdentity?.identity_data) {
        const discordId = discordIdentity.identity_data.provider_id as string;
        const discordUsername =
          (discordIdentity.identity_data.full_name as string) ||
          (discordIdentity.identity_data.name as string) ||
          (discordIdentity.identity_data.custom_claims?.global_name as string) ||
          null;

        await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email,
            discord_id: discordId,
            discord_username: discordUsername,
            role: "member",
          },
          { onConflict: "id", ignoreDuplicates: false }
        );

        await supabase
          .from("profiles")
          .update({ discord_id: discordId, discord_username: discordUsername })
          .eq("id", user.id);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
