"use client";

import {
    ThreadPrimitive,
    ComposerPrimitive,
    MessagePrimitive,
} from "@assistant-ui/react";

/**
 * Анимация загрузки - три бегущие точки
 */
function TypingIndicator() {
    return (
        <div
            className="animate-message-enter"
            style={{
                maxWidth: "min(75%, 48rem)",
                marginLeft: "0",
                marginRight: "auto",
            }}
        >
            <div
                style={{
                    background: "var(--assistant-bubble)",
                    color: "var(--assistant-bubble-text)",
                    border: "1px solid var(--assistant-bubble-border)",
                    borderRadius: "var(--radius-lg)",
                    padding: "0.875rem 1rem",
                    boxShadow: "var(--shadow-soft)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    minWidth: "60px",
                    justifyContent: "center",
                }}
            >
                <span className="typing-dot" style={{ animationDelay: "0ms" }} />
                <span className="typing-dot" style={{ animationDelay: "150ms" }} />
                <span className="typing-dot" style={{ animationDelay: "300ms" }} />
            </div>
        </div>
    );
}

/**
 * Компонент для отображения индикатора во время загрузки
 * Использует ThreadPrimitive.If для условного рендеринга
 */
function LoadingIndicator() {
    return (
        <ThreadPrimitive.If running>
            <TypingIndicator />
        </ThreadPrimitive.If>
    );
}

function Bubble({ children, kind }: { children: React.ReactNode; kind: "user" | "assistant" }) {
    const isUser = kind === "user";

    return (
        <div
            className="animate-message-enter"
            style={{
                maxWidth: "min(75%, 48rem)",
                marginLeft: isUser ? "auto" : "0",
                marginRight: isUser ? "0" : "auto",
            }}
        >
            <div
                style={{
                    background: isUser ? "var(--user-bubble)" : "var(--assistant-bubble)",
                    color: isUser ? "var(--user-bubble-text)" : "var(--assistant-bubble-text)",
                    border: isUser ? "none" : "1px solid var(--assistant-bubble-border)",
                    borderRadius: "var(--radius-lg)",
                    padding: "0.875rem 1rem",
                    fontSize: "var(--font-size-base)",
                    lineHeight: "var(--line-height-base)",
                    boxShadow: "var(--shadow-soft)",
                    wordWrap: "break-word",
                    overflowWrap: "break-word",
                }}
            >
                <div className="message-content">
                    {children}
                </div>
            </div>
        </div>
    );
}

function UserMessage() {
    return (
        <MessagePrimitive.Root className="flex">
            <Bubble kind="user">
                <MessagePrimitive.Parts />
            </Bubble>
        </MessagePrimitive.Root>
    );
}

function AssistantMessage() {
    return (
        <MessagePrimitive.Root className="flex">
            <Bubble kind="assistant">
                <MessagePrimitive.Parts />
            </Bubble>
        </MessagePrimitive.Root>
    );
}

function EmptyState() {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "16rem",
                padding: "2rem",
                textAlign: "center",
            }}
        >
            <div
                style={{
                    fontSize: "2.5rem",
                    marginBottom: "1rem",
                    opacity: 0.3,
                }}
            >
                💬
            </div>
            <div
                style={{
                    color: "var(--text-muted)",
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 500,
                }}
            >
                Write message to start chat
            </div>
        </div>
    );
}

export function Thread() {
    return (
        <ThreadPrimitive.Root
            className="flex h-full flex-col"
            style={{
                background: "var(--bg)",
            }}
        >
            {/* Messages Viewport */}
            <ThreadPrimitive.Viewport
                className="flex-1 overflow-y-auto"
                style={{
                    padding: "1.5rem 1rem",
                }}
            >
                <div
                    style={{
                        maxWidth: "56rem",
                        margin: "0 auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                    }}
                >
                    <ThreadPrimitive.Empty>
                        <EmptyState />
                    </ThreadPrimitive.Empty>

                    <ThreadPrimitive.Messages
                        components={{ UserMessage, AssistantMessage }}
                    />

                    <LoadingIndicator />
                </div>
            </ThreadPrimitive.Viewport>

            {/* Composer Area */}
            <div
                style={{
                    background: "var(--surface)",
                    borderTop: "1px solid var(--border)",
                    padding: "1rem",
                    boxShadow: "var(--shadow-soft)",
                }}
            >
                <div
                    style={{
                        maxWidth: "56rem",
                        margin: "0 auto",
                    }}
                >
                    <ComposerPrimitive.Root
                        className="flex gap-2"
                        style={{
                            alignItems: "flex-end",
                        }}
                    >
                        <div className="flex-1 composer-input-wrapper">
                            <ComposerPrimitive.Input
                                placeholder="Message..."
                                className="composer-input"
                            />
                        </div>
                        <ComposerPrimitive.Send asChild>
                            <button className="composer-send-button">
                                Send
                            </button>
                        </ComposerPrimitive.Send>
                    </ComposerPrimitive.Root>
                </div>
            </div>
        </ThreadPrimitive.Root>
    );
}
