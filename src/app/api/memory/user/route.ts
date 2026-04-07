import { NextResponse } from "next/server";
import { getPool, initMemoryTables } from "@/lib/db";

// GET /api/memory/user?userId=xxx
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ summary: "", facts: {} });

    try {
        await initMemoryTables();
        const db = getPool();
        const { rows } = await db.query(
            "SELECT summary, facts FROM user_memory WHERE user_id = $1",
            [userId]
        );
        if (rows.length === 0) return NextResponse.json({ summary: "", facts: {} });
        return NextResponse.json({ summary: rows[0].summary, facts: rows[0].facts });
    } catch (e) {
        console.error("[memory/user] GET error:", e);
        return NextResponse.json({ summary: "", facts: {} });
    }
}
