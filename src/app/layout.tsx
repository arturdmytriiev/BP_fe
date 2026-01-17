import type { ReactNode } from "react";
import "./globals.css";
import { MyRuntimeProvider } from "./MyRuntimeProvider";

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ru">
        <body>
        <MyRuntimeProvider>{children}</MyRuntimeProvider>
        </body>
        </html>
    );
}
