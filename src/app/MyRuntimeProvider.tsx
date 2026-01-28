"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useEffect } from "react";
import {
    AssistantRuntimeProvider,
    useLocalRuntime,
    type ChatModelAdapter,
    type ThreadHistoryAdapter,
} from "@assistant-ui/react";

function getOrCreateSessionId(storageKey: string) {
    if (typeof window === "undefined") return "temp-session";
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(storageKey, id);
    return id;
}

export function MyRuntimeProvider({ children }: { children: ReactNode }) {
    // Если у тебя есть auth — вместо localStorage просто используй userId
    const [sessionId, setSessionId] = useState(() => {
        if (typeof window === "undefined") return "temp-session";
        return getOrCreateSessionId("flowise_session_id");
    });

    useEffect(() => {
        // Ensure we have the correct session ID on the client
        const id = getOrCreateSessionId("flowise_session_id");
        if (id !== sessionId) {
            setSessionId(id);
        }
    }, [sessionId]);

    const modelAdapter = useMemo<ChatModelAdapter>(
        () => ({
            async *run({ messages, abortSignal }) {
                const last = messages[messages.length - 1];
                const textPart = last?.content?.find((p) => p.type === "text");
                const question = textPart && "text" in textPart ? textPart.text : "";

                const response = await fetch("/api/flowise/stream", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ question, sessionId }),
                    signal: abortSignal,
                });

                if (!response.ok || !response.body) {
                    const errorText = await response.text();
                    throw new Error(`Stream error: ${response.status} - ${errorText}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let accumulatedText = "";
                let buffer = "";

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split("\n");
                        buffer = lines.pop() || "";

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || trimmed.startsWith("event:")) continue;

                            if (trimmed.startsWith("data:")) {
                                const jsonStr = trimmed.slice(5).trim();
                                if (!jsonStr) continue;

                                try {
                                    const parsed = JSON.parse(jsonStr);
                                    if (parsed.token) {
                                        accumulatedText += parsed.token;
                                        yield {
                                            content: [{ type: "text", text: accumulatedText }],
                                        };
                                    } else if (parsed.text) {
                                        accumulatedText = parsed.text;
                                        yield {
                                            content: [{ type: "text", text: accumulatedText }],
                                        };
                                    }
                                } catch {
                                    // не JSON, возможно простой текст токена
                                    accumulatedText += jsonStr;
                                    yield {
                                        content: [{ type: "text", text: accumulatedText }],
                                    };
                                }
                            }
                        }
                    }
                } finally {
                    reader.releaseLock();
                }

                // Финальный yield с полным текстом
                yield { content: [{ type: "text", text: accumulatedText }] };
            },
        }),
        [sessionId]
    );

    const historyAdapter = useMemo<ThreadHistoryAdapter>(
        () => ({
            async load() {
                const r = await fetch(
                    `/api/flowise/history?sessionId=${encodeURIComponent(sessionId)}`,
                    { cache: "no-store" }
                );
                const data = await r.json();

                return {
                    messages: (data.messages ?? []).map((m: any) => ({
                        ...m,
                        createdAt: new Date(m.createdAt),
                    })),
                };
            },
            async append() {
                // можно оставить пустым: Flowise сам пишет историю при prediction
            },
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
