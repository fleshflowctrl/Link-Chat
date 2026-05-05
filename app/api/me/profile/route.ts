import { NextResponse } from "next/server";
import {
  editStateToUserProfileUpsert,
  userProfileRowToEditState,
  type UserProfileRow,
} from "@/lib/me/server-profile";
import type { EditProfileState } from "@/data/me-edit";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

const BIO_MAX = 280;

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return bad("Supabase not configured", 503);
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return bad("Server misconfigured", 503);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Unauthorized", 401);

  const { data: row, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[GET /api/me/profile]", error);
    return bad("Failed to load profile", 500);
  }

  if (!row) {
    return NextResponse.json({ profile: null });
  }

  const profile = userProfileRowToEditState(row as UserProfileRow);
  return NextResponse.json({
    profile,
    updatedAt: (row as UserProfileRow).updated_at,
  });
}

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return bad("Supabase not configured", 503);
  }

  let body: EditProfileState;
  try {
    body = (await request.json()) as EditProfileState;
  } catch {
    return bad("Invalid JSON");
  }

  if (!body || typeof body !== "object") return bad("Invalid body");
  if (typeof body.bio === "string" && body.bio.length > BIO_MAX) {
    return bad(`Bio must be at most ${BIO_MAX} characters`);
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return bad("Server misconfigured", 503);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Unauthorized", 401);

  const { data: existing } = await supabase
    .from("user_profiles")
    .select("credits")
    .eq("user_id", user.id)
    .maybeSingle();

  const creditsKeep =
    typeof existing?.credits === "number" && existing.credits >= 0
      ? existing.credits
      : 125;

  const upsert = editStateToUserProfileUpsert(user.id, body);

  const { data: row, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: upsert.user_id,
        first_name: upsert.first_name,
        age: upsert.age,
        location: upsert.location,
        pronouns: upsert.pronouns,
        custom_pronouns: upsert.custom_pronouns,
        bio: upsert.bio,
        looking_for: upsert.looking_for,
        interests: upsert.interests,
        main_photo_url: upsert.main_photo_url,
        gallery: upsert.gallery,
        preferences: upsert.preferences,
        updated_at: upsert.updated_at,
        credits: creditsKeep,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("[PATCH /api/me/profile]", error);
    return bad("Failed to save profile", 500);
  }

  const profile = userProfileRowToEditState(row as UserProfileRow);
  return NextResponse.json({
    profile,
    updatedAt: (row as UserProfileRow).updated_at,
  });
}
