"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { setOverrideAction } from "@/modules/users/actions";
import { SCOPE_LABELS } from "@/lib/authz/catalog";

type Perm = { key: string; module: string; label: string; description: string; scoped: boolean };
type Scope = keyof typeof SCOPE_LABELS;

export function PermissionOverrides({
  userId,
  permissions,
  roleScopes,
  overrides,
}: {
  userId: string;
  permissions: Perm[];
  roleScopes: Record<string, Scope>;
  overrides: Record<string, { effect: "GRANT" | "DENY"; scope: Scope }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState(() =>
    Object.fromEntries(Object.entries(overrides).map(([k, o]) => [k, o.effect === "DENY" ? "DENY" : `GRANT:${o.scope}`])),
  );
  const modules = [...new Set(permissions.map((p) => p.module))];

  const change = (key: string, value: string) => {
    const previous = values[key] ?? "";
    setValues((v) => ({ ...v, [key]: value }));
    const [effect, scope] = value === "" ? [null, "ALL"] : value === "DENY" ? ["DENY", "ALL"] : value.split(":");
    start(async () => {
      const res = await setOverrideAction({ userId, permissionKey: key, effect: effect as "GRANT" | "DENY" | null, scope: scope as Scope });
      if (res?.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res?.message ?? "Não foi possível salvar.");
        setValues((v) => ({ ...v, [key]: previous }));
      }
    });
  };

  return (
    <div className="grid gap-5">
      {modules.map((m) => (
        <div key={m}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m}</p>
          <div className="divide-y rounded-lg border">
            {permissions
              .filter((p) => p.module === m)
              .map((p) => {
                const role = roleScopes[p.key];
                const value = values[p.key] ?? "";
                return (
                  <div key={p.key} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_140px_220px] sm:items-center">
                    <div>
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Papel: </span>
                      {role ? (p.scoped ? SCOPE_LABELS[role] : "Sim") : "Sem acesso"}
                    </div>
                    <div className="flex items-center gap-2">
                      <NativeSelect
                        value={value}
                        disabled={pending}
                        onChange={(e) => change(p.key, e.target.value)}
                        aria-label={`Exceção para ${p.label}`}
                      >
                        <option value="">Padrão do papel</option>
                        {p.scoped ? (
                          (Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
                            <option key={s} value={`GRANT:${s}`}>
                              Conceder: {SCOPE_LABELS[s]}
                            </option>
                          ))
                        ) : (
                          <option value="GRANT:ALL">Conceder</option>
                        )}
                        <option value="DENY">Negar</option>
                      </NativeSelect>
                      {value && <Badge variant={value === "DENY" ? "destructive" : "default"}>Exceção</Badge>}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
