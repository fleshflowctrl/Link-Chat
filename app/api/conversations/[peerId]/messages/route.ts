import { NextResponse } from "next/server";
import type { ChatMessage } from "@/data/messages";
import {
  messageRowToUi,
  type ChatMessageRow,
  type ChatProfileRow,
} from "@/lib/chat/map-rows";
import type { GrokInputMessage } from "@/lib/xai/grok-responses";
import { grokResponsesComplete } from "@/lib/xai/grok-responses";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const MAX_LEN = 4000;

export async function GET(
  _request: Request,
  { params }: { params: { peerId: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const peerId = params.peerId;
  const { data: msgs, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("peer_id", peerId)
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    messages: ((msgs ?? []) as ChatMessageRow[]).map(messageRowToUi),
  });
}

export async function POST(
  request: Request,
  { params }: { params: { peerId: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const peerId = params.peerId;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const text =
    typeof body === "object" &&
    body !== null &&
    "text" in body &&
    typeof (body as { text: unknown }).text === "string"
      ? (body as { text: string }).text.trim()
      : "";

  if (!text) {
    return NextResponse.json({ ok: false, error: "Missing text" }, { status: 400 });
  }
  if (text.length > MAX_LEN) {
    return NextResponse.json(
      { ok: false, error: `Message too long (max ${MAX_LEN} chars)` },
      { status: 400 },
    );
  }

  const { data: profile, error: pe } = await supabase
    .from("chat_profiles")
    .select("*")
    .eq("id", peerId)
    .maybeSingle();

  if (pe || !profile) {
    return NextResponse.json({ ok: false, error: "Unknown peer" }, { status: 404 });
  }

  const p = profile as ChatProfileRow;

  const { data: insertedUser, error: ie } = await supabase
    .from("chat_messages")
    .insert({
      peer_id: peerId,
      sender: "me",
      kind: "text",
      body: text,
      owner_user_id: user.id,
    })
    .select("*")
    .single();

  if (ie || !insertedUser) {
    return NextResponse.json(
      { ok: false, error: ie?.message ?? "Insert failed" },
      { status: 500 },
    );
  }

  const userMessage = messageRowToUi(insertedUser as ChatMessageRow);

  const { data: historyRows, error: he } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("peer_id", peerId)
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (he) {
    return NextResponse.json(
      { ok: true, userMessage, peerMessage: null, warning: he.message },
      { status: 200 },
    );
  }

  const history = (historyRows ?? []) as ChatMessageRow[];

  let peerMessage: ChatMessage | null = null;
  let warning: string | undefined;

  if (p.is_ai) {
    const system = `${p.bio}

Keep replies natural and fairly short (under ~100 words). You are ${p.display_name} in a private dating-app chat.`;

    const tail = history.slice(-24);
    const input: GrokInputMessage[] = [
      { role: "system", content: system },
      ...tail.map((r) => ({
        role: (r.sender === "me" ? "user" : "assistant") as "user" | "assistant",
        content:
          r.kind === "image"
            ? "[They sent a photo]"
            : (r.body ?? "").trim() || "…",
      })),
    ];

    const grok = await grokResponsesComplete(input);

    if (grok.ok) {
      const { data: insertedPeer, error: peIns } = await supabase
        .from("chat_messages")
        .insert({
          peer_id: peerId,
          sender: "peer",
          kind: "text",
          body: grok.text,
          owner_user_id: user.id,
        })
        .select("*")
        .single();

      if (!peIns && insertedPeer) {
        peerMessage = messageRowToUi(insertedPeer as ChatMessageRow);
      } else if (peIns) {
        warning = peIns.message;
      }
    } else {
      warning = grok.error;
    }
  }

  return NextResponse.json({
    ok: true,
    userMessage,
    peerMessage,
    ...(warning ? { warning } : {}),
  });
}
