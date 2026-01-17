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
        return NextResponse.json(
            { error: await r.text() },
            { status: r.status || 500 }
        );
    }

    const data: any = await r.json();
    const text = data.text ?? data.answer ?? data?.data ?? "";

    return NextResponse.json({ text });
}
