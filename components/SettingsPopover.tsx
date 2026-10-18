"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Landmark, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { ConnectBankSheet } from "@/components/ConnectBankSheet";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/hooks/useAuth";

export function SettingsPopover() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

  // next-themes: theme is unknown on the server, mount before reading it.
  useEffect(() => setMounted(true), []);

  return (
    <>
      {user && (
        <ConnectBankSheet
          userId={user.id}
          open={bankOpen}
          onOpenChange={setBankOpen}
        />
      )}
    <Popover>
      <PopoverTrigger
        aria-label="Configurações"
        className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
      >
        <Settings className="size-5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Tema
          </p>
          {mounted && (
            <ToggleGroup
              value={theme ? [theme] : []}
              onValueChange={(value) => value[0] && setTheme(value[0])}
              className="w-full"
            >
              <ToggleGroupItem value="light" aria-label="Claro" className="flex-1">
                <Sun className="size-4" aria-hidden />
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Escuro" className="flex-1">
                <Moon className="size-4" aria-hidden />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="system"
                aria-label="Sistema"
                className="flex-1"
              >
                <Monitor className="size-4" aria-hidden />
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>

        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setBankOpen(true)}
        >
          <Landmark className="size-4" aria-hidden />
          Conectar banco
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={logout}
        >
          <LogOut className="size-4" aria-hidden />
          Sair
        </Button>
      </PopoverContent>
    </Popover>
    </>
  );
}
