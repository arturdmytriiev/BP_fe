import type { ReactNode } from "react";
import "./globals.css";
import { SessionProvider } from "./SessionContext";

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="sk">
        <body>
        <SessionProvider>
            {children}
        </SessionProvider>
        </body>
        </html>
    );
}
