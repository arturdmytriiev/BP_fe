import type { ReactNode } from "react";
import "./globals.css";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { SessionProvider } from "./SessionContext";
import { AUTH_BASE_PATH } from "@/lib/base-path";

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="sk">
        <body>
        <NextAuthSessionProvider basePath={AUTH_BASE_PATH}>
            <SessionProvider>
                {children}
            </SessionProvider>
        </NextAuthSessionProvider>
        </body>
        </html>
    );
}
