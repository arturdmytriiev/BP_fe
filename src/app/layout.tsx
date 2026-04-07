import type { ReactNode } from "react";
import "./globals.css";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { SessionProvider } from "./SessionContext";

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="sk">
        <body>
        <NextAuthSessionProvider>
            <SessionProvider>
                {children}
            </SessionProvider>
        </NextAuthSessionProvider>
        </body>
        </html>
    );
}
