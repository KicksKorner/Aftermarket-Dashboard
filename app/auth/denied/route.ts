import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// The portal is admin-only. Non-admins land here from the members layout:
// sign them out and send them back to the login page with an explanation.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL("/login?error=admin_only", request.url));
}
