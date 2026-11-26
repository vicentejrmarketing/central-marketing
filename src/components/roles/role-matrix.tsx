"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NativeSelect } from "@/components/ui/native-select";
import { setRolePermissionAction } from "@/modules/roles/actions";
import { SCOPE_LABELS } from "@/lib/authz/catalog";

type Perm = { key: string; module: string; label: string; description: string; scoped: boolean };
type Scope = keyof typeof SCOPE_LABELS;

export function RoleMatrix({
  roleId,
  permissions,
  scopes,
  locked,
}: {
  roleId: string;
  permissions: Perm[];
  scopes: Record<string, Scope>;
  locked: string[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(scopes);
  const [pending, start] = useTransition();
  const modules = [...new Set(permissions.map((p) => p.module))];

  const change = (key: string, value: string) => {
    const previous = values[key] ?? "";
    setValues((v) => ({ ...v, [key]: value }));
    start(async () => {
      const res = await setRolePermissionAction({ roleId, permissionKey: key, scope: value === "" ? null : (value as Scope) });
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
              .map((p) => (
                <div key={p.key} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_220px] sm:items-center">
                  <div>
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                  <NativeSelect
                    value={values[p.key] ?? ""}
                    disabled={pending || locked.includes(p.key)}
                    onChange={(e) => change(p.key, e.target.value)}
                    aria-label={p.label}
                  >
                    <option value="">Sem acesso</option>
                    {p.scoped ? (
                      (Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
                        <option key={s} value={s}>
                          {SCOPE_LABELS[s]}
                        </option>
                      ))
                    ) : (
                      <option value="ALL">Permitido</option>
                    )}
                  </NativeSelect>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
