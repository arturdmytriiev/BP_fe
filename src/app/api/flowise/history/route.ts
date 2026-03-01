import { NextResponse } from "next/server";

const HISTORY_LIMIT = 20;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ messages: [] });

    const base = process.env.FLOWISE_URL!;
    const chatflowId = process.env.FLOWISE_CHATFLOW_ID!;
    const apiKey = process.env.FLOWISE_API_KEY;

    const url = `${base}/api/v1/chatmessage/${chatflowId}?sessionId=${encodeURIComponent(sessionId)}&limit=${HISTORY_LIMIT}`;

    const r = await fetch(url, {
        headers: {
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        cache: "no-store",
    });

    if (!r.ok) return NextResponse.json({ messages: [] });

    const raw: any[] = await r.json();

    // Sort chronologically regardless of what order Flowise returns
    const ordered = (Array.isArray(raw) ? raw : []).sort((a, b) => {
        const aTime = new Date(a.createdDate ?? a.createdAt ?? 0).getTime();
        const bTime = new Date(b.createdDate ?? b.createdAt ?? 0).getTime();
        return aTime - bTime;
    });

    const messages = ordered.map((m) => ({
        id: m.id ?? globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
        role:
            m.role === "userMessage" || m.role === "user"
                ? "user"
                : "assistant",
        content: [{ type: "text", text: m.content ?? "" }],
        createdAt: m.createdDate ?? m.createdAt ?? new Date().toISOString(),
    }));

    return NextResponse.json({ messages });
}
