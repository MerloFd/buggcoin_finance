import type { ReactNode } from "react";
import { SettingsPopover } from "@/components/SettingsPopover";
import { BottomNav } from "@/components/BottomNav";
import { Sidebar } from "@/components/Sidebar";
import { Logo } from "@/components/Logo";
import { Fab } from "@/components/Fab";
import { PendingMatchesBanner } from "@/components/PendingMatchesBanner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full lg:flex">
      <Sidebar />

      <div className="flex min-h-full flex-1 flex-col">
        {/* Mobile header — the Sidebar carries the brand + settings on desktop */}
        <header className="sticky top-0 z-10 border-b border-border bg-card lg:hidden">
          <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
            <Logo size="sm" />
            <SettingsPopover />
          </div>
        </header>

        <PendingMatchesBanner />

        {/* pb clears the fixed BottomNav on mobile; roomy centered column on desktop */}
        <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-4 lg:max-w-3xl lg:pb-10 lg:pt-8">
          {children}
        </main>

        <BottomNav />
        <Fab />
      </div>
    </div>
  );
}
