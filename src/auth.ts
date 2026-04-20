import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { AUTH_BASE_PATH, stripBasePath, withBasePath } from "@/lib/base-path";
import { recordUserLogin } from "@/lib/db";

const ALLOWED_DOMAINS = ["stuba.sk", "stud.stuba.sk"];
const isDevelopment = process.env.NODE_ENV !== "production";

if (isDevelopment) {
    // In local dev, let Auth.js infer the actual host/port from the request.
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
}

export const authConfig = {
    basePath: AUTH_BASE_PATH,
    providers: [
        Google({
            authorization: { params: { prompt: "select_account" } },
        }),
    ],
    pages: {
        signIn: withBasePath("/login"),
        error: withBasePath("/login"),
    },
    callbacks: {
        async signIn({ profile }) {
            const email = profile?.email;
            if (!email) return false;
            const allowed = ALLOWED_DOMAINS.some((domain) => email.endsWith(`@${domain}`));
            if (!allowed) return false;
            try {
                await recordUserLogin(email);
            } catch (e) {
                console.error("[auth] failed to record login:", e);
            }
            return true;
        },
        authorized({ auth: session, request }) {
            const pathname = stripBasePath(request.nextUrl.pathname);
            // Allow access to login page and auth API without session
            if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
                return true;
            }
            return !!session?.user;
        },
    },
};

export const { auth, signIn, signOut } = NextAuth(authConfig);
