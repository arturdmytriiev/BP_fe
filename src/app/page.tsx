import { Thread } from "@/components/assistant-ui/thread";
import { ThemeToggle } from "@/components/assistant-ui/theme-toggle";
import { SessionSidebar } from "@/components/assistant-ui/session-sidebar";
import { MyRuntimeProvider } from "@/app/MyRuntimeProvider";

export default function Page() {
    return (
        <main className="h-screen flex overflow-hidden">
            <SessionSidebar />
            <div className="flex-1 min-w-0">
                <MyRuntimeProvider>
                    <Thread />
                </MyRuntimeProvider>
            </div>
            <ThemeToggle />
        </main>
    );
}
