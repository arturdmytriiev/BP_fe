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
            streaming: true,
            overrideConfig: { sessionId },
        }),
    });

    if (!r.ok || !r.body) {
        return new Response(await r.text(), { status: r.status || 500 });
    }


    return new Response(r.body, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}
