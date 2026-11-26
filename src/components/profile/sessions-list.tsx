"use client";
import { MonitorSmartphone } from "lucide-react";
import { ConfirmActionButton } from "@/components/form/confirm-action-button";
import { Badge } from "@/components/ui/badge";
import { revokeSessionAction } from "@/modules/users/actions";
import { formatDateTime } from "@/lib/format";

function device(ua: string | null) {
  if (!ua) return "Dispositivo desconhecido";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Navegador";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return `${browser}${os ? ` no ${os}` : ""}`;
}

export function SessionsList({
  sessions,
  currentId,
}: {
  sessions: { id: string; userAgent: string | null; ip: string | null; lastSeenAt: string; createdAt: string }[];
  currentId: string;
}) {
  return (
    <ul className="divide-y">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <MonitorSmartphone className="size-5 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">
                {device(s.userAgent)}{" "}
                {s.id === currentId && (
                  <Badge variant="success" className="ml-1">
                    Esta sessão
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.ip ?? "IP desconhecido"} · último uso {formatDateTime(s.lastSeenAt)} · entrou em {formatDateTime(s.createdAt)}
              </p>
            </div>
          </div>
          {s.id !== currentId && (
            <ConfirmActionButton
              action={() => revokeSessionAction({ id: s.id })}
              title="Encerrar sessão"
              description="Esse dispositivo precisará entrar de novo."
              confirmLabel="Encerrar"
              variant="ghost"
              destructive
            >
              Encerrar
            </ConfirmActionButton>
          )}
        </li>
      ))}
    </ul>
  );
}
