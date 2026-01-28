"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useEffect } from "react";
import {
    AssistantRuntimeProvider,
    useLocalRuntime,
    type ChatModelAdapter,
    type ThreadHistoryAdapter,
} from "@assistant-ui/react";

function safeRandomId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function getOrCreateSessionId(storageKey: string) {
    if (typeof window === "undefined") return "temp-session";
    try {
        const storage = window.localStorage;
        const existing = storage.getItem(storageKey);
        if (existing) return existing;
        const id = safeRandomId();
        storage.setItem(storageKey, id);
        return id;
    } catch {
        // storage может быть недоступен (политики/инкогнито/ограничения)
        return `temp-${safeRandomId()}`;
    }
}

export function MyRuntimeProvider({ children }: { children: ReactNode }) {
    // Важно: не читаем localStorage во время SSR/первого рендера
    const [sessionId, setSessionId] = useState("temp-session");

    useEffect(() => {
        setSessionId(getOrCreateSessionId("flowise_session_id"));
    }, []);

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

                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;

                        // DEBUG: логируем что приходит от сервера
                        console.log("[Stream chunk]:", chunk);

                        // Flowise может отправлять данные в разных форматах
                        // Попробуем обработать как SSE или как обычный текстовый поток
                        const lines = buffer.split("\n");
                        buffer = lines.pop() || "";

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed) continue;

                            console.log("[Stream line]:", trimmed);

                            // Пропускаем event: строки
                            if (trimmed.startsWith("event:")) continue;

                            let dataContent = trimmed;

                            // Извлекаем данные после "data:"
                            if (trimmed.startsWith("data:")) {
                                dataContent = trimmed.slice(5).trim();
                            }

                            if (!dataContent) continue;

                            // Пробуем распарсить как JSON
                            try {
                                const parsed = JSON.parse(dataContent);

                                // Разные форматы Flowise
                                if (typeof parsed === "string") {
                                    accumulatedText += parsed;
                                } else if (parsed.token) {
                                    accumulatedText += parsed.token;
                                } else if (parsed.text) {
                                    accumulatedText = parsed.text;
                                } else if (parsed.data) {
                                    accumulatedText += typeof parsed.data === "string"
                                        ? parsed.data
                                        : JSON.stringify(parsed.data);
                                } else if (parsed.message) {
                                    accumulatedText += parsed.message;
                                }

                                if (accumulatedText) {
                                    yield {
                                        content: [{ type: "text", text: accumulatedText }],
                                    };
                                }
                            } catch {
                                // Не JSON - просто добавляем как текст
                                // Но пропускаем служебные сообщения SSE
                                if (!dataContent.startsWith("[") && dataContent !== "ping") {
                                    accumulatedText += dataContent;
                                    yield {
                                        content: [{ type: "text", text: accumulatedText }],
                                    };
                                }
                            }
                        }
                    }

                    // Обрабатываем остаток буфера
                    if (buffer.trim()) {
                        const remaining = buffer.trim();
                        const dataMatch = remaining.startsWith("data:")
                            ? remaining.slice(5).trim()
                            : remaining;

                        if (dataMatch) {
                            try {
                                const parsed = JSON.parse(dataMatch);
                                if (typeof parsed === "string") {
                                    accumulatedText += parsed;
                                } else if (parsed.token) {
                                    accumulatedText += parsed.token;
                                } else if (parsed.text) {
                                    accumulatedText = parsed.text;
                                }
                            } catch {
                                if (!dataMatch.startsWith("[") && dataMatch !== "ping") {
                                    accumulatedText += dataMatch;
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
