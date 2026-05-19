import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { reversePromptFromImage } from "@/lib/admin/image-lab-reverse-prompt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  imageDataUrl?: string;
  imageUrl?: string;
};

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const image =
    (typeof body.imageDataUrl === "string" && body.imageDataUrl.trim()) ||
    (typeof body.imageUrl === "string" && body.imageUrl.trim()) ||
    "";

  if (!image) {
    return NextResponse.json(
      { error: "Geen afbeelding ontvangen (plak of upload)." },
      { status: 400 },
    );
  }

  if (image.startsWith("data:") && image.length > 6_000_000) {
    return NextResponse.json(
      { error: "Afbeelding te groot (max ~4MB base64)." },
      { status: 400 },
    );
  }

  const result = await reversePromptFromImage(image);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, prompt: result.prompt });
}
