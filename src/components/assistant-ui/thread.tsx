"use client";

import {
    ThreadPrimitive,
    ComposerPrimitive,
    MessagePrimitive,
} from "@assistant-ui/react";

function Bubble({ children, kind }: { children: React.ReactNode; kind: "user" | "assistant" }) {
    const base =
        "max-w-[75%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap";
    const cls =
        kind === "user"
            ? `${base} ml-auto bg-blue-600 text-white`
            : `${base} mr-auto bg-zinc-200 text-zinc-900`;
    return <div className={cls}>{children}</div>;
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

export function Thread() {
    return (
        <ThreadPrimitive.Root className="flex h-full flex-col">
            <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto p-4 space-y-3">
                <ThreadPrimitive.Empty>
                    <div className="text-zinc-500 text-sm">Напиши сообщение…</div>
                </ThreadPrimitive.Empty>

                <ThreadPrimitive.Messages
                    components={{ UserMessage, AssistantMessage }}
                />
            </ThreadPrimitive.Viewport>

            <div className="border-t p-3">
                <ComposerPrimitive.Root className="flex gap-2">
                    <ComposerPrimitive.Input
                        className="flex-1 rounded-lg border px-3 py-2"
                        placeholder="Сообщение…"
                    />
                    <ComposerPrimitive.Send asChild>
                        <button className="rounded-lg border px-4 py-2">
                            Send
                        </button>
                    </ComposerPrimitive.Send>
                </ComposerPrimitive.Root>
            </div>
        </ThreadPrimitive.Root>
    );
}
