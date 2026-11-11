import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { Brand } from "@/components/brand";
import type { Profile } from "@/lib/types";

export function ParticipantHeader({ profile }: { profile: Profile }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Brand size="sm" />
        <div className="flex items-center gap-3">
          <div className="text-right text-sm leading-tight">
            <p className="font-medium">{profile.full_name}</p>
            <p className="text-xs text-muted-foreground">@{profile.username}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted"
              aria-label="Keluar"
              title="Keluar"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
