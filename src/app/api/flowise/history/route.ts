import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ messages: [] });

    const base = process.env.FLOWISE_URL!;
    const chatflowId = process.env.FLOWISE_CHATFLOW_ID!;
    const apiKey = process.env.FLOWISE_API_KEY;
    
    const r = await fetch(
        `${base}/api/v1/chatmessage/${chatflowId}?sessionId=${encodeURIComponent(
            sessionId
        )}`,
        {
            headers: {
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            cache: "no-store",
        }
    );

    if (!r.ok) return NextResponse.json({ messages: [] });

    const raw: any[] = await r.json();

    const messages = raw.map((m) => ({
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
