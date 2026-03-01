"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from "react";

export interface Session {
    id: string;
    createdAt: string;
    label: string;
}

interface SessionContextType {
    currentSessionId: string | null;
    sessions: Session[];
    createNewSession: () => void;
    switchSession: (id: string) => void;
    updateSessionLabel: (id: string, label: string) => void;
    deleteSession: (id: string) => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

const SESSIONS_KEY = "flowise_sessions";
const CURRENT_SESSION_KEY = "flowise_current_session_id";

function safeRandomId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function formatSessionLabel(date: Date) {
    return (
        date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        " " +
        date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
}

function loadSessions(): Session[] {
    try {
        const raw = localStorage.getItem(SESSIONS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveSessions(sessions: Session[]) {
    try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch {}
}

export function SessionProvider({ children }: { children: ReactNode }) {
    // null = not yet initialized (avoids mounting runtime with a temp ID)
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);

    useEffect(() => {
        const stored = loadSessions();
        const storedCurrent = localStorage.getItem(CURRENT_SESSION_KEY);

        if (stored.length > 0) {
            const current = stored.find((s) => s.id === storedCurrent) ?? stored[0];
            setCurrentSessionId(current.id);
            setSessions(stored);
        } else {
            // Migrate legacy session ID so Flowise keeps its context
            const legacyId = localStorage.getItem("flowise_session_id");
            const id = legacyId ?? safeRandomId();
            const session: Session = {
                id,
                createdAt: new Date().toISOString(),
                label: legacyId ? "Previous chat" : formatSessionLabel(new Date()),
            };
            saveSessions([session]);
            localStorage.setItem(CURRENT_SESSION_KEY, id);
            setCurrentSessionId(id);
            setSessions([session]);
        }
    }, []);

    const createNewSession = useCallback(() => {
        const id = safeRandomId();
        const now = new Date();
        const session: Session = {
            id,
            createdAt: now.toISOString(),
            label: formatSessionLabel(now),
        };
        setSessions((prev) => {
            const updated = [session, ...prev];
            saveSessions(updated);
            return updated;
        });
        localStorage.setItem(CURRENT_SESSION_KEY, id);
        setCurrentSessionId(id);
    }, []);

    const switchSession = useCallback((id: string) => {
        localStorage.setItem(CURRENT_SESSION_KEY, id);
        setCurrentSessionId(id);
    }, []);

    const updateSessionLabel = useCallback((id: string, label: string) => {
        setSessions((prev) => {
            const updated = prev.map((s) => (s.id === id ? { ...s, label } : s));
            saveSessions(updated);
            return updated;
        });
    }, []);

    const deleteSession = useCallback((id: string) => {
        setSessions((prev) => {
            let updated = prev.filter((s) => s.id !== id);
            if (updated.length === 0) {
                const newId = safeRandomId();
                const session: Session = { id: newId, createdAt: new Date().toISOString(), label: formatSessionLabel(new Date()) };
                updated = [session];
            }
            saveSessions(updated);
            return updated;
        });
        setCurrentSessionId((cur) => {
            if (cur !== id) return cur;
            // Active session was deleted — pick first from updated localStorage list
            const remaining = JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? "[]") as Session[];
            const next = remaining[0];
            if (next) {
                localStorage.setItem(CURRENT_SESSION_KEY, next.id);
                return next.id;
            }
            return cur;
        });
    }, []);

    return (
        <SessionContext.Provider
            value={{ currentSessionId, sessions, createNewSession, switchSession, updateSessionLabel, deleteSession }}
        >
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error("useSession must be used within SessionProvider");
    return ctx;
}
