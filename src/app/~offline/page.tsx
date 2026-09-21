import { Logo } from "@/components/shared/logo";
import { OfflineRetry } from "./offline-retry";

export const metadata = {
  title: "You're offline · MoneyMapPH",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <Logo size="lg" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">You&apos;re offline</h1>
        <p className="text-sm text-muted-foreground">
          MoneyMapPH couldn&apos;t reach the server. Check your connection and try again.
        </p>
      </div>
      <OfflineRetry />
    </main>
  );
}