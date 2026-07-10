"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsClient } from "@/hooks/use-is-client";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isClient = useIsClient();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Changer de thème">
            {isClient && resolvedTheme === "dark" ? (
              <Moon className="size-5" />
            ) : (
              <Sun className="size-5" />
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={isClient ? (theme ?? "system") : "system"}
          onValueChange={(value) => setTheme(value as string)}
        >
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" /> Clair
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" /> Sombre
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" /> Système
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
