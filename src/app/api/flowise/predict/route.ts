import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const { question, sessionId } = await req.json();

    const base = process.env.FLOWISE_URL!;
    const chatflowId = process.env.FLOWISE_CHATFLOW_ID!;
    const apiKey = process.env.FLOWISE_API_KEY;

    const r = await fetch(`${base}/api/v1/prediction/${chatflowId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
            question,
            overrideConfig: { sessionId },
        }),
    });

    if (!r.ok) {
        const errorText = await r.text();
        console.error(`[predict] Flowise error ${r.status}:`, errorText);
        let message = `Flowise error (${r.status})`;
        try {
            const parsed = JSON.parse(errorText);
            message = parsed.message ?? parsed.error ?? message;
        } catch {}
        return NextResponse.json({ error: message }, { status: r.status || 500 });
    }

    const data: any = await r.json();
    let text: string = data.text ?? data.answer ?? data?.data ?? "";
    let videoUrl: string | null = data.videoUrl ?? data.video_url ?? data.video ?? null;

    // If text itself is JSON from the tool result (e.g. manim-renderer response)
    if (!videoUrl && text) {
        try {
            const parsed = JSON.parse(text);
            if (parsed.video_url) {
                videoUrl = parsed.video_url;
                text = "";
            }
        } catch {}
    }

    return NextResponse.json({ text, ...(videoUrl ? { videoUrl } : {}) });
}
