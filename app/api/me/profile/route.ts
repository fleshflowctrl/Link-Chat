import { NextResponse } from "next/server";
import {
  editStateToUserProfileUpsert,
  userProfileRowToEditState,
  type UserProfileRow,
} from "@/lib/me/server-profile";
import type { EditProfileState } from "@/data/me-edit";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";
import {
  COMPLETENESS_FIELDS,
  isFieldComplete,
  type CompletenessField,
} from "@/lib/me/profile-completeness";

const BIO_MAX = 280;

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return bad("Supabase niet geconfigureerd", 503);
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return bad("Server verkeerd geconfigureerd", 503);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Niet geautoriseerd", 401);

  const { data: row, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[GET /api/me/profile]", error);
    return bad("Profiel laden mislukt", 500);
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
    return bad("Supabase niet geconfigureerd", 503);
  }

  let body: EditProfileState;
  try {
    body = (await request.json()) as EditProfileState;
  } catch {
    return bad("Ongeldige JSON");
  }

  if (!body || typeof body !== "object") return bad("Ongeldige body");
  if (typeof body.bio === "string" && body.bio.length > BIO_MAX) {
    return bad(`Bio mag maximaal ${BIO_MAX} tekens zijn`);
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return bad("Server verkeerd geconfigureerd", 503);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Niet geautoriseerd", 401);

  const { data: existing } = await supabase
    .from("user_profiles")
    .select("credits, stat_chats, stat_links, stat_likes")
    .eq("user_id", user.id)
    .maybeSingle();

  const creditsKeep =
    typeof existing?.credits === "number" && existing.credits >= 0
      ? existing.credits
      : 125;

  const statChatsKeep =
    typeof existing?.stat_chats === "number" && existing.stat_chats >= 0
      ? existing.stat_chats
      : 0;
  const statLinksKeep =
    typeof existing?.stat_links === "number" && existing.stat_links >= 0
      ? existing.stat_links
      : 0;
  const statLikesKeep =
    typeof existing?.stat_likes === "number" && existing.stat_likes >= 0
      ? existing.stat_likes
      : 0;

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
        stat_chats: statChatsKeep,
        stat_links: statLinksKeep,
        stat_likes: statLikesKeep,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("[PATCH /api/me/profile]", error);
    return bad("Profiel opslaan mislukt", 500);
  }

  const profile = userProfileRowToEditState(row as UserProfileRow);

  // ── Auto-claim profile-completion rewards ─────────────────────────────
  // Pay credits for each milestone that is now satisfied AND not already
  // recorded in `user_profile_rewards`. Idempotent thanks to PK constraint.
  let creditsBalance = creditsKeep;
  const awardedMilestones: { key: CompletenessField; credits: number }[] = [];

  try {
    const eligible = COMPLETENESS_FIELDS.filter(
      (f) => f.reward > 0 && isFieldComplete(profile, f.key),
    );

    if (eligible.length > 0) {
      const { data: paid } = await supabase
        .from("user_profile_rewards")
        .select("milestone")
        .eq("owner_user_id", user.id)
        .in(
          "milestone",
          eligible.map((f) => f.key),
        );

      const paidSet = new Set(
        (paid ?? []).map((r) => r.milestone as string),
      );
      const toClaim = eligible.filter((f) => !paidSet.has(f.key));

      if (toClaim.length > 0) {
        const totalReward = toClaim.reduce((sum, f) => sum + f.reward, 0);
        creditsBalance = creditsKeep + totalReward;

        const { error: updErr } = await supabase
          .from("user_profiles")
          .update({ credits: creditsBalance })
          .eq("user_id", user.id);

        if (updErr) {
          console.error("[PATCH /api/me/profile] credits update", updErr);
          creditsBalance = creditsKeep;
        } else {
          const inserts = toClaim.map((f) => ({
            owner_user_id: user.id,
            milestone: f.key,
            credits_paid: f.reward,
          }));
          const { error: insErr } = await supabase
            .from("user_profile_rewards")
            .insert(inserts);

          if (insErr) {
            // Refund on bookkeeping failure so we don't pay twice next time.
            console.error("[PATCH /api/me/profile] rewards insert", insErr);
            await supabase
              .from("user_profiles")
              .update({ credits: creditsKeep })
              .eq("user_id", user.id);
            creditsBalance = creditsKeep;
          } else {
            for (const f of toClaim) {
              awardedMilestones.push({ key: f.key, credits: f.reward });
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("[PATCH /api/me/profile] reward flow", e);
    /* best effort — never block the profile save itself */
  }

  return NextResponse.json({
    profile,
    updatedAt: (row as UserProfileRow).updated_at,
    awarded: awardedMilestones,
    creditsBalance,
  });
}
