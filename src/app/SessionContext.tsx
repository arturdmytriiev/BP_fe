"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from "react";
import { useSession as useAuthSession } from "next-auth/react";

export interface Session {
    id: string;
    createdAt: string;
    label: string;
}

interface SessionContextType {
    currentSessionId: string | null;
    userId: string | null;
    sessions: Session[];
    createNewSession: () => void;
    switchSession: (id: string) => void;
    updateSessionLabel: (id: string, label: string) => void;
    deleteSession: (id: string) => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

const USER_ID_KEY = "flowise_user_id";


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

function sessionsKey(email: string) {
    return `flowise_sessions_${email}`;
}

function currentSessionKey(email: string) {
    return `flowise_current_session_id_${email}`;
}

function loadSessions(email: string): Session[] {
    try {
        const raw = localStorage.getItem(sessionsKey(email));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveSessions(email: string, sessions: Session[]) {
    try {
        localStorage.setItem(sessionsKey(email), JSON.stringify(sessions));
    } catch {}
}

export function SessionProvider({ children }: { children: ReactNode }) {
    const { data: authSession, status } = useAuthSession();
    const email = authSession?.user?.email ?? null;

    // null = not yet initialized (avoids mounting runtime with a temp ID)
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);

    useEffect(() => {
        // Wait until auth is resolved and we have an email
        if (status === "loading" || !email) return;

        // Persistent user ID — survives session resets, never changes
        const storedUserId = localStorage.getItem(USER_ID_KEY) ?? safeRandomId();
        localStorage.setItem(USER_ID_KEY, storedUserId);
        setUserId(storedUserId);

        const stored = loadSessions(email);
        const storedCurrent = localStorage.getItem(currentSessionKey(email));

        if (stored.length > 0) {
            const current = stored.find((s) => s.id === storedCurrent) ?? stored[0];
            setCurrentSessionId(current.id);
            setSessions(stored);
        } else {
            const id = safeRandomId();
            const session: Session = {
                id,
                createdAt: new Date().toISOString(),
                label: formatSessionLabel(new Date()),
            };
            saveSessions(email, [session]);
            localStorage.setItem(currentSessionKey(email), id);
            setCurrentSessionId(id);
            setSessions([session]);
        }
    }, [email, status]);

    const createNewSession = useCallback(() => {
        if (!email) return;
        const id = safeRandomId();
        const now = new Date();
        const session: Session = {
            id,
            createdAt: now.toISOString(),
            label: formatSessionLabel(now),
        };
        setSessions((prev) => {
            const updated = [session, ...prev];
            saveSessions(email, updated);
            return updated;
        });
        localStorage.setItem(currentSessionKey(email), id);
        setCurrentSessionId(id);
    }, [email]);

    const switchSession = useCallback((id: string) => {
        if (!email) return;
        localStorage.setItem(currentSessionKey(email), id);
        setCurrentSessionId(id);
    }, [email]);

    const updateSessionLabel = useCallback((id: string, label: string) => {
        if (!email) return;
        setSessions((prev) => {
            const updated = prev.map((s) => (s.id === id ? { ...s, label } : s));
            saveSessions(email, updated);
            return updated;
        });
    }, [email]);

    const deleteSession = useCallback((id: string) => {
        if (!email) return;
        setSessions((prev) => {
            let updated = prev.filter((s) => s.id !== id);
            if (updated.length === 0) {
                const newId = safeRandomId();
                const session: Session = { id: newId, createdAt: new Date().toISOString(), label: formatSessionLabel(new Date()) };
                updated = [session];
            }
            saveSessions(email, updated);
            return updated;
        });
        setCurrentSessionId((cur) => {
            if (cur !== id) return cur;
            const remaining = JSON.parse(localStorage.getItem(sessionsKey(email)) ?? "[]") as Session[];
            const next = remaining[0];
            if (next) {
                localStorage.setItem(currentSessionKey(email), next.id);
                return next.id;
            }
            return cur;
        });
    }, [email]);

    return (
        <SessionContext.Provider
            value={{ currentSessionId, userId, sessions, createNewSession, switchSession, updateSessionLabel, deleteSession }}
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
