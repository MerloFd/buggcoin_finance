"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/nav-items";
import { SettingsPopover } from "@/components/SettingsPopover";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

// Desktop navigation. Hidden on mobile, where the BottomNav takes over.
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col border-r border-border bg-card p-4 lg:flex">
      <div className="px-2 pb-6">
        <Logo size="md" />
      </div>

      <nav className="flex-1">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, primary }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    primary
                      ? "bg-primary text-primary-foreground"
                      : active
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <SettingsPopover />
        <span className="text-sm text-muted-foreground">Configurações</span>
      </div>
    </aside>
  );
}
