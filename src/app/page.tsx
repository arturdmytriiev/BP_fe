import { Thread } from "@/components/assistant-ui/thread";
import { ThemeToggle } from "@/components/assistant-ui/theme-toggle";

export default function Page() {
  return (
      <main className="h-screen">
        <Thread />
        <ThemeToggle />
      </main>
  );
}
