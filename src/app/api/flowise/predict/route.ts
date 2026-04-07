import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const { question, sessionId, userMemory } = await req.json();

    // Prepend long-term memory context so the LLM is aware of the user's profile
    const enrichedQuestion = userMemory
        ? `[User context: ${userMemory}]\n\n${question}`
        : question;

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
            question: enrichedQuestion,
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
            if (parsed.final_video_url ?? parsed.video_url) {
                videoUrl = parsed.final_video_url ?? parsed.video_url;
                text = "";
            }
        } catch {}
    }

    // Extract quiz timeLimit — handles both:
    //   raw:        {"timeLimit":30}
    //   code block: ```json\n{"timeLimit":30}\n```
    // Only activates the timer if the message actually contains answer options (A/B/C),
    // so result/summary messages don't get buttons even if they carry the JSON.
    let timeLimit: number | null = null;
    const codeBlockMatch = text.match(/```json\s*\{\s*"timeLimit"\s*:\s*(\d+)\s*\}\s*```/s);
    const rawMatch = !codeBlockMatch ? text.match(/\{\s*"timeLimit"\s*:\s*(\d+)\s*\}/) : null;
    const jsonMatch = codeBlockMatch ?? rawMatch;

    if (jsonMatch) {
        // Strip the JSON token (use \s* to handle any whitespace inside the braces)
        const cleaned = codeBlockMatch
            ? text.replace(codeBlockMatch[0], "")
            : text.replace(/\{\s*"timeLimit"\s*:\s*\d+\s*\}/g, "");

        // Collapse leftover blank lines and trim
        const normalised = cleaned.replace(/\n{3,}/g, "\n\n").trim();

        // Only activate the timer if the message has actual A/B/C answer options.
        // Matches lines starting with "A)" … "D)" (multiline ^) — reliable quiz indicator.
        const hasAnswerOptions = /^[A-D]\)/m.test(normalised);
        if (hasAnswerOptions) {
            timeLimit = parseInt(jsonMatch[1], 10);
        }
        text = normalised;
    }

    return NextResponse.json({
        text,
        ...(videoUrl ? { videoUrl } : {}),
        ...(timeLimit !== null ? { timeLimit } : {}),
    });
}
