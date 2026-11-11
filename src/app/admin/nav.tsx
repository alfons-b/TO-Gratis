"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/peserta", label: "Peserta" },
  { href: "/admin/soal", label: "Bank Soal" },
  { href: "/admin/ujian", label: "Pengaturan Ujian" },
  { href: "/admin/token", label: "Token" },
  { href: "/admin/hasil", label: "Hasil" },
  { href: "/admin/ekspor", label: "Ekspor" },
  { href: "/admin/akun", label: "Pengaturan Akun" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="mx-auto max-w-7xl overflow-x-auto px-2">
      <ul className="flex min-w-max gap-1">
        {ITEMS.map((it) => {
          const active = it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "inline-block border-b-2 px-3 py-2.5 text-sm",
                  active
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
