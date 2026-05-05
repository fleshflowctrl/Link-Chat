/**
 * Resolve public Supabase URL + anon/publishable key.
 * Supports NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (this repo) and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase dashboard default name) for Vercel/deploys.
 */
export function getSupabasePublicEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicEnv() !== null;
}
