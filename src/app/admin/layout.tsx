import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { Brand } from "@/components/brand";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Brand size="sm" />
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Admin</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">@{admin.username}</span>
            <form action={logoutAction}>
              <button type="submit" className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-muted">
                <LogOut className="size-4" /> Keluar
              </button>
            </form>
          </div>
        </div>
        <AdminNav />
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
