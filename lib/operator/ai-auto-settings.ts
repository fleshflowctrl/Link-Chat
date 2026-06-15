import type { SupabaseClient } from "@supabase/supabase-js";

export type OperatorAppSettings = {
  aiAutoReplyEnabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

const ROW_ID = 1;

export async function getOperatorAppSettings(
  supabase: SupabaseClient,
): Promise<OperatorAppSettings> {
  const { data, error } = await supabase
    .from("operator_app_settings")
    .select("ai_auto_reply_enabled, updated_at, updated_by")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error || !data) {
    return {
      aiAutoReplyEnabled: false,
      updatedAt: null,
      updatedBy: null,
    };
  }

  return {
    aiAutoReplyEnabled: Boolean(data.ai_auto_reply_enabled),
    updatedAt: (data.updated_at as string | null) ?? null,
    updatedBy: (data.updated_by as string | null) ?? null,
  };
}

export async function setOperatorAiAutoReplyEnabled(
  supabase: SupabaseClient,
  enabled: boolean,
  updatedBy: string,
): Promise<OperatorAppSettings> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("operator_app_settings")
    .upsert(
      {
        id: ROW_ID,
        ai_auto_reply_enabled: enabled,
        updated_at: now,
        updated_by: updatedBy,
      },
      { onConflict: "id" },
    )
    .select("ai_auto_reply_enabled, updated_at, updated_by")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Instelling opslaan mislukt");
  }

  return {
    aiAutoReplyEnabled: Boolean(data.ai_auto_reply_enabled),
    updatedAt: (data.updated_at as string | null) ?? null,
    updatedBy: (data.updated_by as string | null) ?? null,
  };
}

export function resolveOperatorAiActorId(settings: OperatorAppSettings): string | null {
  if (settings.updatedBy) return settings.updatedBy;
  const env = process.env.TELEGRAM_OPERATOR_USER_ID?.trim();
  return env || null;
}
