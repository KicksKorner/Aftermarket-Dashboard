import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Relative Location: on Netlify, request.url is the per-deploy permalink host,
// so an absolute redirect built from it would bounce users off the main domain.
function redirectTo(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

// The portal is admin-only. Non-admins land here from the members layout:
// sign them out and send them back to the login page with an explanation.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role === "admin") {
      return redirectTo("/admin");
    }
    await supabase.auth.signOut();
  }

  return redirectTo("/login?error=admin_only");
}
