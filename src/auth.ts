import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { AUTH_BASE_PATH, stripBasePath, withBasePath } from "@/lib/base-path";

const ALLOWED_DOMAINS = ["stuba.sk", "stud.stuba.sk"];
const isDevelopment = process.env.NODE_ENV !== "production";

if (isDevelopment) {
    // In local dev, let Auth.js infer the actual host/port from the request.
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
}

export const authConfig = {
    basePath: AUTH_BASE_PATH,
    providers: [Google],
    pages: {
        signIn: withBasePath("/login"),
        error: withBasePath("/login"),
    },
    callbacks: {
        signIn({ profile }) {
            const email = profile?.email;
            if (!email) return false;
            return ALLOWED_DOMAINS.some((domain) => email.endsWith(`@${domain}`));
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
