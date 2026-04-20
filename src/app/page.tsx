import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Thread } from "@/components/assistant-ui/thread";
import { ThemeToggle } from "@/components/assistant-ui/theme-toggle";
import { SessionSidebar } from "@/components/assistant-ui/session-sidebar";
import { MyRuntimeProvider } from "@/app/MyRuntimeProvider";

export default async function Page() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    return (
        <main className="h-[100dvh] flex overflow-hidden w-full">
            <SessionSidebar />
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
                <MyRuntimeProvider>
                    <Thread />
                </MyRuntimeProvider>
            </div>
            <ThemeToggle />
        </main>
    );
}
