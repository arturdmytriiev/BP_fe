"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
    const [theme, setTheme] = useState<"light" | "dark" | null>(null);

    useEffect(() => {
        // Check for saved theme preference or use system preference
        if (typeof window === "undefined") return;

        const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

        const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
        setTheme(initialTheme);
        applyTheme(initialTheme);
    }, []);

    const applyTheme = (newTheme: "light" | "dark") => {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(newTheme);
    };

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        applyTheme(newTheme);
        localStorage.setItem("theme", newTheme);
    };

    if (theme === null) {
        // Prevent flash during hydration
        return null;
    }

    return (
        <button
            onClick={toggleTheme}
            aria-label={`Переключить на ${theme === "light" ? "тёмную" : "светлую"} тему`}
            title={`Переключить на ${theme === "light" ? "тёмную" : "светлую"} тему`}
            style={{
                position: "fixed",
                top: "1rem",
                right: "1rem",
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "50%",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
                boxShadow: "var(--shadow-soft)",
                transition: "transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast)",
                zIndex: 1000,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "var(--shadow-medium)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "var(--shadow-soft)";
            }}
            onMouseDown={(e) => {
                e.currentTarget.style.transform = "scale(0.95)";
            }}
            onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
            }}
        >
            {theme === "light" ? "🌙" : "☀️"}
        </button>
    );
}
