"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2, MailPlus, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyLink } from "@/components/form/copy-link";
import { ConfirmActionButton } from "@/components/form/confirm-action-button";
import { createResetLinkAction, resendInviteAction, setUserStatusAction } from "@/modules/users/actions";

export function AccountActions({
  id,
  name,
  active,
  pendingInvite,
  isSelf,
}: {
  id: string;
  name: string;
  active: boolean;
  pendingInvite: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [link, setLink] = useState<{ url: string; label: string } | null>(null);
  const [pending, start] = useTransition();

  const generate = (kind: "invite" | "reset") =>
    start(async () => {
      const res = kind === "invite" ? await resendInviteAction({ id }) : await createResetLinkAction({ id });
      if (!res?.ok) return void toast.error(res?.message);
      toast.success(res.message);
      if (res.data && !res.data.emailSent)
        setLink({ url: res.data.url, label: kind === "invite" ? "Link do convite (72 horas)" : "Link de redefinição (1 hora)" });
      router.refresh();
    });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {active && pendingInvite && (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => generate("invite")}>
            {pending ? <Loader2 className="animate-spin" /> : <MailPlus />} Reenviar convite
          </Button>
        )}
        {active && !pendingInvite && (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => generate("reset")}>
            {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Gerar link de redefinição de senha
          </Button>
        )}
        {!isSelf &&
          (active ? (
            <ConfirmActionButton
              action={() => setUserStatusAction({ id, active: false })}
              title={`Desativar ${name}?`}
              description="A pessoa perde o acesso na hora e todas as sessões abertas são encerradas. O histórico e os registros dela continuam no sistema."
              confirmLabel="Desativar"
              destructive
            >
              <UserX /> Desativar
            </ConfirmActionButton>
          ) : (
            <ConfirmActionButton
              action={() => setUserStatusAction({ id, active: true })}
              title={`Reativar ${name}?`}
              description="A pessoa volta a ter acesso com a senha que já tinha."
              confirmLabel="Reativar"
            >
              <UserCheck /> Reativar
            </ConfirmActionButton>
          ))}
      </div>
      {link && (
        <div className="grid gap-1.5">
          <p className="text-sm text-muted-foreground">O envio de e-mail não está configurado. {link.label}:</p>
          <CopyLink url={link.url} label={link.label} />
        </div>
      )}
    </div>
  );
}
