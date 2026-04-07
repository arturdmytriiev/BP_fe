import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_DOMAINS = ["stuba.sk", "stud.stuba.sk"];

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [Google],
    pages: {
        signIn: "/login",
        error: "/login",
    },
    callbacks: {
        signIn({ profile }) {
            const email = profile?.email;
            if (!email) return false;
            return ALLOWED_DOMAINS.some((domain) => email.endsWith(`@${domain}`));
        },
        authorized({ auth: session, request }) {
            const { pathname } = request.nextUrl;
            // Allow access to login page and auth API without session
            if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
                return true;
            }
            return !!session?.user;
        },
    },
});
