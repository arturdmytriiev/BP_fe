"use client";

import { useSession as useAuthSession, signOut } from "next-auth/react";
import { useSession, type Session } from "@/app/SessionContext";
import { withBasePath } from "@/lib/base-path";

function SessionItem({
    session,
    isActive,
    onClick,
    onDelete,
}: {
    session: Session;
    isActive: boolean;
    onClick: () => void;
    onDelete: () => void;
}) {
    return (
        <div className={`session-item${isActive ? " session-item--active" : ""}`}>
            <button
                onClick={onClick}
                className="session-item__label-btn"
                title={session.label}
            >
                <span className="session-item__label">{session.label}</span>
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="session-item__delete"
                title="Delete chat"
                aria-label="Delete chat"
            >
                ×
            </button>
        </div>
    );
}

export function SessionSidebar() {
    const { sessions, currentSessionId, createNewSession, switchSession, deleteSession } = useSession();
    const { data: authSession } = useAuthSession();

    const sorted = [...sessions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return (
        <aside className="session-sidebar">
            <div className="session-sidebar__header">
                <span className="session-sidebar__title">Chats</span>
            </div>

            <button onClick={createNewSession} className="new-chat-button">
                + New chat
            </button>

            <div className="session-sidebar__list">
                {sorted.map((s) => (
                    <SessionItem
                        key={s.id}
                        session={s}
                        isActive={s.id === currentSessionId}
                        onClick={() => switchSession(s.id)}
                        onDelete={() => deleteSession(s.id)}
                    />
                ))}
            </div>

            {authSession?.user && (
                <div className="session-sidebar__user">
                    <div className="session-sidebar__user-info" title={authSession.user.email ?? ""}>
                        <span className="session-sidebar__user-name">
                            {authSession.user.name ?? authSession.user.email}
                        </span>
                        <span className="session-sidebar__user-email">
                            {authSession.user.email}
                        </span>
                    </div>
                    <button
                        onClick={() => signOut({ callbackUrl: withBasePath("/login") })}
                        className="session-sidebar__logout"
                        title="Odhlásiť sa"
                    >
                        Odhlásiť sa
                    </button>
                </div>
            )}
        </aside>
    );
}
