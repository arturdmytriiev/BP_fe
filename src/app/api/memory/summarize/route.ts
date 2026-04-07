import { NextResponse } from "next/server";
import { getPool, initMemoryTables } from "@/lib/db";

const FLOWISE_URL = process.env.FLOWISE_URL!;
const FLOWISE_CHATFLOW_ID = process.env.FLOWISE_CHATFLOW_ID!;
const FLOWISE_API_KEY = process.env.FLOWISE_API_KEY;

// Fetch all messages for a session from Flowise
async function fetchSessionMessages(sessionId: string): Promise<{ role: string; content: string }[]> {
    const url = `${FLOWISE_URL}/api/v1/chatmessage/${FLOWISE_CHATFLOW_ID}?sessionId=${encodeURIComponent(sessionId)}&limit=100`;
    const r = await fetch(url, {
        headers: { ...(FLOWISE_API_KEY ? { Authorization: `Bearer ${FLOWISE_API_KEY}` } : {}) },
        cache: "no-store",
    });
    if (!r.ok) return [];
    const raw: any[] = await r.json();
    return (Array.isArray(raw) ? raw : [])
        .sort((a, b) => new Date(a.createdDate ?? 0).getTime() - new Date(b.createdDate ?? 0).getTime())
        .map((m) => ({
            role: m.role === "userMessage" || m.role === "user" ? "user" : "assistant",
            content: m.content ?? "",
        }));
}

// Call Flowise with a one-off session to get a summary
async function summarizeWithLLM(
    messages: { role: string; content: string }[],
    existingSummary: string,
    existingFacts: Record<string, unknown>
): Promise<{ summary: string; facts: Record<string, unknown> } | null> {
    if (messages.length < 2) return null;

    const conversation = messages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");

    const prompt = `You are a memory extraction system. Analyze this conversation and return a JSON object with updated facts about the user.

EXISTING PROFILE:
${existingSummary ? `Summary: ${existingSummary}` : "No previous summary."}
${Object.keys(existingFacts).length > 0 ? `Facts: ${JSON.stringify(existingFacts)}` : ""}

NEW CONVERSATION:
${conversation}

Return ONLY valid JSON, no markdown, no explanation:
{
  "summary": "2-3 sentences about the user and what they discussed",
  "facts": {
    "name": "user name if mentioned or null",
    "language": "primary language of the conversation",
    "interests": ["list of topics"],
    "knowledge_level": "beginner | intermediate | advanced",
    "goals": ["what the user wants to achieve"],
    "preferences": {}
  }
}`;

    // Use a unique one-off sessionId so this call never pollutes real history
    const tempSessionId = `_summarize_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    try {
        const r = await fetch(`${FLOWISE_URL}/api/v1/prediction/${FLOWISE_CHATFLOW_ID}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(FLOWISE_API_KEY ? { Authorization: `Bearer ${FLOWISE_API_KEY}` } : {}),
            },
            body: JSON.stringify({
                question: prompt,
                overrideConfig: { sessionId: tempSessionId },
            }),
        });
        if (!r.ok) return null;
        const data = await r.json();
        const text: string = data.text ?? data.answer ?? "";

        // Extract JSON — sometimes LLM wraps it in markdown
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            summary: typeof parsed.summary === "string" ? parsed.summary : "",
            facts: typeof parsed.facts === "object" && parsed.facts !== null ? parsed.facts : {},
        };
    } catch (e) {
        console.error("[summarize] LLM call failed:", e);
        return null;
    }
}

// POST /api/memory/summarize  { sessionId, userId }
export async function POST(req: Request) {
    let sessionId: string, userId: string;
    try {
        ({ sessionId, userId } = await req.json());
    } catch {
        return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    }
    if (!sessionId || !userId) {
        return NextResponse.json({ ok: false, error: "sessionId and userId required" }, { status: 400 });
    }

    try {
        await initMemoryTables();
        const db = getPool();

        // Load existing memory
        const { rows } = await db.query(
            "SELECT summary, facts FROM user_memory WHERE user_id = $1",
            [userId]
        );
        const existing = rows[0] ?? { summary: "", facts: {} };

        // Fetch conversation
        const messages = await fetchSessionMessages(sessionId);
        if (messages.length < 2) {
            return NextResponse.json({ ok: true, skipped: true });
        }

        // Summarize
        const result = await summarizeWithLLM(messages, existing.summary, existing.facts);
        if (!result) {
            return NextResponse.json({ ok: true, skipped: true });
        }

        // Upsert into user_memory
        await db.query(
            `INSERT INTO user_memory (user_id, summary, facts, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (user_id)
             DO UPDATE SET summary = $2, facts = $3, updated_at = NOW()`,
            [userId, result.summary, JSON.stringify(result.facts)]
        );

        return NextResponse.json({ ok: true, summary: result.summary });
    } catch (e) {
        console.error("[memory/summarize] error:", e);
        return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
    }
}
