"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, Users, Settings, LogOut, Sun, Moon, ChevronDown, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clientes", href: "/clients", icon: Users },
  { label: "Configuración", href: "/settings", icon: Settings, adminOnly: true },
];

interface SidebarProps {
  userName: string;
  userEmail: string;
  isAdmin: boolean;
  clients: { id: string; name: string }[];
}

export function Sidebar({ userName, userEmail, isAdmin, clients }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Current client ID from URL
  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  const activeClientId = clientMatch?.[1] ?? null;

  // Auto-expand when on any /clients/* path
  const isClientsSection = pathname.startsWith("/clients");
  const [clientsOpen, setClientsOpen] = useState(isClientsSection);

  // Keep open if navigating within clients section
  useEffect(() => {
    if (isClientsSection) setClientsOpen(true);
  }, [isClientsSection]);

  // Scroll active client into view
  const activeClientRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    activeClientRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeClientId]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-sidebar shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 12C3 7.03 7.03 3 12 3s9 4.03 9 9-4.03 9-9 9"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4"
              stroke="white"
              strokeWidth="2.5"
            />
          </svg>
        </div>
        <span className="font-bold text-sm text-foreground tracking-tight">
          Chill Digital
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const isClientes = item.href === "/clients";
          const isActive = item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          if (isClientes) {
            return (
              <div key={item.href}>
                {/* Clientes toggle row */}
                <div className="flex items-center">
                  <Link
                    href={item.href}
                    className={cn(
                      "flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-brand-400" : "text-current")} />
                    {item.label}
                  </Link>
                  {clients.length > 0 && (
                    <button
                      onClick={() => setClientsOpen((o) => !o)}
                      className="p-1.5 mr-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                    >
                      {clientsOpen
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>

                {/* Client sub-list */}
                {clientsOpen && clients.length > 0 && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-border space-y-0.5 max-h-64 overflow-y-auto">
                    {clients.map((c) => {
                      const isActiveClient = c.id === activeClientId;
                      return (
                        <Link
                          key={c.id}
                          href={`/clients/${c.id}`}
                          ref={isActiveClient ? activeClientRef : undefined}
                          className={cn(
                            "block truncate rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                            isActiveClient
                              ? "bg-brand-500/15 text-brand-400"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          )}
                        >
                          {c.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-brand-400" : "text-current")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {mounted && (theme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />)}
            <span>{mounted ? (theme === "dark" ? "Modo oscuro" : "Modo claro") : "Modo oscuro"}</span>
          </div>
          <button
            role="switch"
            aria-checked={mounted && theme === "dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
              mounted && theme === "dark" ? "bg-brand-500" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                mounted && theme === "dark" ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </div>

      {/* Usuario */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-brand-400">
              {initials || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {userName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
