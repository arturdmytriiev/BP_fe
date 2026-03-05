"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import {
    AssistantRuntimeProvider,
    useLocalRuntime,
    type ChatModelAdapter,
    type ThreadHistoryAdapter,
} from "@assistant-ui/react";
import { useSession } from "./SessionContext";

// Remounts entirely when sessionId changes → fresh runtime + fresh history load
function RuntimeForSession({ sessionId, children }: { sessionId: string; children: ReactNode }) {
    const modelAdapter = useMemo<ChatModelAdapter>(
        () => ({
            async run({ messages, abortSignal }) {
                const last = messages[messages.length - 1];
                const textPart = last?.content?.find((p) => p.type === "text");
                const question = textPart && "text" in textPart ? textPart.text : "";

                const r = await fetch("/api/flowise/predict", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ question, sessionId }),
                    signal: abortSignal,
                });

                const raw = await r.text();
                let data: any = {};
                try { data = JSON.parse(raw); } catch {}

                if (!r.ok) {
                    return { content: [{ type: "text", text: `⚠️ ${data.error || `Predict failed (${r.status})`}` }] };
                }
                const content: any[] = [{ type: "text", text: data.text ?? "" }];
                if (data.videoUrl) content.push({ type: "video", videoUrl: data.videoUrl });
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
                        `/api/flowise/history?sessionId=${encodeURIComponent(sessionId)}`,
                        { cache: "no-store" }
                    );
                    if (!r.ok) return { messages: [] };
                    const data = await r.json();

                    // Build ThreadMessage array
                    const threadMessages = (data.messages ?? [])
                        .filter((m: any) => m && m.id && m.role)
                        .map((m: any) => {
                            const base = {
                                id: m.id as string,
                                role: m.role as "user" | "assistant",
                                content: m.content ?? [{ type: "text", text: "" }],
                                createdAt: new Date(m.createdAt),
                                // metadata is required — metadata.unstable_state is read
                                // in BaseThreadRuntimeCore.get state without optional chaining
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

                    // ExportedMessageRepository format: each item needs { message, parentId }
                    // parentId links messages as a linear chain (null for root)
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
    const { currentSessionId } = useSession();

    // Don't mount the runtime until we have a real session ID.
    // This prevents the race condition where the runtime starts loading history
    // for a temporary ID and then gets detached before the load completes.
    if (!currentSessionId) return null;

    return (
        <RuntimeForSession key={currentSessionId} sessionId={currentSessionId}>
            {children}
        </RuntimeForSession>
    );
}
