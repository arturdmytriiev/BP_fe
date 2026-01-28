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

                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;

                        // DEBUG: логируем что приходит от сервера
                        console.log("[Stream chunk]:", chunk);

                        // Flowise отправляет данные в формате:
                        // event: token\ndata: "текст"\n\n
                        // И системные сообщения: message:FINISHED, message:{...}, message[DONE]
                        const lines = buffer.split("\n");
                        buffer = lines.pop() || "";

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed) continue;

                            console.log("[Stream line]:", trimmed);

                            // Пропускаем системные сообщения Flowise
                            if (trimmed.startsWith("message:")) continue;
                            if (trimmed.startsWith("message[")) continue;
                            if (trimmed.startsWith("event:")) continue;

                            // Извлекаем данные после "data:"
                            let dataContent = trimmed;
                            if (trimmed.startsWith("data:")) {
                                dataContent = trimmed.slice(5).trim();
                            }

                            if (!dataContent) continue;

                            // Пробуем распарсить как JSON
                            try {
                                const parsed = JSON.parse(dataContent);

                                // Пропускаем системные JSON объекты (агент-флоу данные)
                                if (parsed.status || parsed.previousNodeIds || parsed.chatId || parsed.chatMessageId) {
                                    continue;
                                }

                                // Токен текста (основной формат для стриминга)
                                if (typeof parsed === "string") {
                                    accumulatedText += parsed;
                                    yield {
                                        content: [{ type: "text", text: accumulatedText }],
                                    };
                                } else if (parsed.token) {
                                    accumulatedText += parsed.token;
                                    yield {
                                        content: [{ type: "text", text: accumulatedText }],
                                    };
                                } else if (parsed.text && !parsed.status) {
                                    // Финальный текст (но не системный объект)
                                    accumulatedText = parsed.text;
                                    yield {
                                        content: [{ type: "text", text: accumulatedText }],
                                    };
                                }
                            } catch {
                                // Не JSON - это может быть простой текстовый токен
                                // Но пропускаем служебные строки
                                if (
                                    !dataContent.startsWith("[") &&
                                    !dataContent.startsWith("{") &&
                                    dataContent !== "ping" &&
                                    !dataContent.includes("FINISHED") &&
                                    !dataContent.includes("previousNodeIds")
                                ) {
                                    accumulatedText += dataContent;
                                    yield {
                                        content: [{ type: "text", text: accumulatedText }],
                                    };
                                }
                            }
                        }
                    }

                    // Обрабатываем остаток буфера (если есть)
                    if (buffer.trim()) {
                        const remaining = buffer.trim();
                        // Пропускаем системные сообщения
                        if (!remaining.startsWith("message:") && !remaining.startsWith("message[")) {
                            const dataMatch = remaining.startsWith("data:")
                                ? remaining.slice(5).trim()
                                : remaining;

                            if (dataMatch) {
                                try {
                                    const parsed = JSON.parse(dataMatch);
                                    if (parsed.status || parsed.previousNodeIds || parsed.chatId) {
                                        // Системные данные - пропускаем
                                    } else if (typeof parsed === "string") {
                                        accumulatedText += parsed;
                                    } else if (parsed.token) {
                                        accumulatedText += parsed.token;
                                    } else if (parsed.text && !parsed.status) {
                                        accumulatedText = parsed.text;
                                    }
                                } catch {
                                    // Не добавляем остаток если это не чистый текст
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
