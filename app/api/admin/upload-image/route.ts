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

  // Ensure proper extension
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  const ext = mimeToExt[file.type] || file.name.split(".").pop() || "jpg";
  const fileName = `deal-images/${Date.now()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from("public-assets")
    .upload(fileName, buffer, {
      contentType: file.type || `image/${ext}`,
      upsert: true,
    });

  if (error) {
    console.error("Storage upload error:", error);
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("public-assets")
    .getPublicUrl(fileName);

  console.log("Uploaded image URL:", urlData.publicUrl);
  return NextResponse.json({ url: urlData.publicUrl });
}
