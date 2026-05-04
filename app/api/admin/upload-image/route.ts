import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `deal-images/${Date.now()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { data, error } = await supabase.storage
    .from("public-assets")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    console.error("Storage upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("public-assets")
    .getPublicUrl(fileName);

  return NextResponse.json({ url: urlData.publicUrl });
}
