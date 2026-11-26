"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Loader2, Search } from "lucide-react";
import type { SearchResult } from "@/modules/search/service";
import { cn } from "@/lib/utils";

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const reqId = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        if (res.ok && id === reqId.current) {
          setResults((await res.json()).results);
          setActive(0);
        }
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const go = (r: SearchResult) => {
    setOpen(false);
    setQ("");
    router.push(r.href);
  };

  const visible = q.trim().length >= 2 ? results : [];
  const groups = [...new Set(visible.map((r) => r.group))];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground shadow-xs hover:bg-accent">
          <Search className="size-4" />
          <span className="flex-1 truncate text-left">Buscar lojas, regiões, pessoas…</span>
          <kbd className="hidden rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-card shadow-xl">
          <DialogPrimitive.Title className="sr-only">Busca global</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Digite pelo menos duas letras.</DialogPrimitive.Description>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, visible.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                }
                if (e.key === "Enter" && visible[active]) go(visible[active]);
              }}
              placeholder="Digite para buscar…"
              className="h-12 flex-1 bg-transparent text-sm outline-none"
              aria-label="Buscar"
            />
            {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {q.trim().length >= 2 && !loading && visible.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nada encontrado para “{q.trim()}”.</p>
            )}
            {groups.map((g) => (
              <div key={g} className="mb-2">
                <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g}</p>
                {visible.map((r, i) =>
                  r.group !== g ? null : (
                    <button
                      key={`${r.group}-${r.id}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r)}
                      className={cn("flex w-full flex-col items-start rounded-md px-3 py-2 text-left", i === active && "bg-accent")}
                    >
                      <span className="text-sm font-medium">{r.title}</span>
                      {r.subtitle && <span className="text-xs text-muted-foreground">{r.subtitle}</span>}
                    </button>
                  ),
                )}
              </div>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
