"use client";

import type { ReactNode } from "react";
import { useMemo, useEffect, useRef } from "react";
import {
    AssistantRuntimeProvider,
    useLocalRuntime,
    type ChatModelAdapter,
    type ThreadHistoryAdapter,
} from "@assistant-ui/react";
import { useSession } from "./SessionContext";
import { withBasePath } from "@/lib/base-path";

/* ── Memory save config ── */
const SUMMARIZE_EVERY_N_MESSAGES = 5;   // after every N assistant responses
const SUMMARIZE_INTERVAL_MS = 3 * 60_000; // periodic check every 3 min

/** Normal fetch-based summarize (fire-and-forget) */
function fireSummarize(sessionId: string, userId: string) {
    return fetch(withBasePath("/api/memory/summarize"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userId }),
    });
}

/** sendBeacon-based summarize — reliable on tab close */
function beaconSummarize(sessionId: string, userId: string) {
    const blob = new Blob(
        [JSON.stringify({ sessionId, userId })],
        { type: "application/json" },
    );
    navigator.sendBeacon(withBasePath("/api/memory/summarize"), blob);
}

/** Fetch latest memory and write it into the ref */
function reloadMemory(userId: string, ref: React.MutableRefObject<string>) {
    fetch(withBasePath(`/api/memory/user?userId=${encodeURIComponent(userId)}`))
        .then((r) => r.json())
        .then((data) => {
            if (data.summary) {
                const facts =
                    data.facts && Object.keys(data.facts).length > 0
                        ? ` Известные факты: ${JSON.stringify(data.facts, null, 0)}.`
                        : "";
                ref.current = `${data.summary}${facts}`;
            }
        })
        .catch(console.error);
}

// Remounts entirely when sessionId changes → fresh runtime + fresh history load
function RuntimeForSession({
    sessionId,
    userId,
    children,
}: {
    sessionId: string;
    userId: string;
    children: ReactNode;
}) {
    // Memory stored in a ref so the modelAdapter closure always reads latest value
    // without needing to be recreated
    const userMemoryRef = useRef<string>("");
    const msgCountRef = useRef(0);

    // Load user memory on mount
    useEffect(() => {
        if (!userId) return;
        reloadMemory(userId, userMemoryRef);
    }, [userId]);

    // ① Periodic save — every 3 min if new messages arrived
    useEffect(() => {
        const id = setInterval(() => {
            if (msgCountRef.current > 0 && sessionId && userId) {
                fireSummarize(sessionId, userId)
                    .then(() => reloadMemory(userId, userMemoryRef))
                    .catch(console.error);
                msgCountRef.current = 0;
            }
        }, SUMMARIZE_INTERVAL_MS);
        return () => clearInterval(id);
    }, [sessionId, userId]);

    // ② beforeunload — save when user closes / reloads the tab
    useEffect(() => {
        const handler = () => {
            if (msgCountRef.current > 0 && sessionId && userId) {
                beaconSummarize(sessionId, userId);
            }
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [sessionId, userId]);

    const modelAdapter = useMemo<ChatModelAdapter>(
        () => ({
            async run({ messages, abortSignal }) {
                const last = messages[messages.length - 1];
                const textPart = last?.content?.find((p) => p.type === "text");
                const question = textPart && "text" in textPart ? textPart.text : "";

                const r = await fetch(withBasePath("/api/flowise/predict"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        question,
                        sessionId,
                        userId,
                        userMemory: userMemoryRef.current,
                    }),
                    signal: abortSignal,
                });

                const raw = await r.text();
                let data: any = {};
                try { data = JSON.parse(raw); } catch {}

                if (!r.ok) {
                    return { content: [{ type: "text", text: `⚠️ ${data.error || `Predict failed (${r.status})`}` }] };
                }

                // ③ After every N assistant responses — summarize & refresh memory
                msgCountRef.current += 1;
                if (msgCountRef.current >= SUMMARIZE_EVERY_N_MESSAGES) {
                    msgCountRef.current = 0;
                    fireSummarize(sessionId, userId)
                        .then(() => reloadMemory(userId, userMemoryRef))
                        .catch(console.error);
                }

                const content: any[] = [{ type: "text", text: data.text ?? "" }];
                if (data.videoUrl) content.push({ type: "video", videoUrl: data.videoUrl });
                if (data.timeLimit) content.push({ type: "quiz", timeLimit: data.timeLimit as number });
                return { content };
            },
        }),
        [sessionId]
    );

    const historyAdapter = useMemo<ThreadHistoryAdapter>(
        () => ({
            async load() {
                try {
                    const r = await fetch(
                        withBasePath(`/api/flowise/history?sessionId=${encodeURIComponent(sessionId)}`),
                        { cache: "no-store" }
                    );
                    if (!r.ok) return { messages: [] };
                    const data = await r.json();

                    const threadMessages = (data.messages ?? [])
                        .filter((m: any) => m && m.id && m.role)
                        .map((m: any) => {
                            const base = {
                                id: m.id as string,
                                role: m.role as "user" | "assistant",
                                content: m.content ?? [{ type: "text", text: "" }],
                                createdAt: new Date(m.createdAt),
                                metadata: { custom: {} },
                            };
                            if (m.role === "assistant") {
                                return {
                                    ...base,
                                    status: { type: "complete" as const, reason: "stop" as const },
                                };
                            }
                            return base;
                        });

                    return {
                        messages: threadMessages.map((msg: any, i: number) => ({
                            message: msg,
                            parentId: i === 0 ? null : threadMessages[i - 1].id,
                        })),
                    };
                } catch {
                    return { messages: [] };
                }
            },
            async append() {},
        }),
        [sessionId]
    );

    const runtime = useLocalRuntime(modelAdapter, {
        adapters: { history: historyAdapter },
    });

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}

export function MyRuntimeProvider({ children }: { children: ReactNode }) {
    const { currentSessionId, userId } = useSession();

    // Track previous sessionId to trigger summarization when the session changes
    const prevSessionRef = useRef<string | null>(null);

    useEffect(() => {
        const prev = prevSessionRef.current;
        prevSessionRef.current = currentSessionId;

        // Fire-and-forget: summarize the session we just left
        if (prev && prev !== currentSessionId && userId) {
            fireSummarize(prev, userId).catch(console.error);
        }
    }, [currentSessionId, userId]);

    // ④ App-level beforeunload — covers the case when no session switch happened
    useEffect(() => {
        const handler = () => {
            if (currentSessionId && userId) {
                beaconSummarize(currentSessionId, userId);
            }
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [currentSessionId, userId]);

    if (!currentSessionId || !userId) return null;

    return (
        <RuntimeForSession key={currentSessionId} sessionId={currentSessionId} userId={userId}>
            {children}
        </RuntimeForSession>
    );
}
