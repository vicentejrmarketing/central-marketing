"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllReadAction, markReadAction } from "@/modules/notifications/actions";

export function MarkAllReadButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await markAllReadAction({});
          if (res?.ok) toast.success(res.message);
          router.refresh();
        })
      }
    >
      <CheckCheck /> Marcar todas como lidas
    </Button>
  );
}

export function MarkReadLink({ id, href, unread, title }: { id: string; href: string | null; unread: boolean; title: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <button
      className="text-left text-sm font-medium hover:text-primary"
      onClick={() =>
        start(async () => {
          if (unread) await markReadAction({ ids: [id] });
          if (href) router.push(href);
          else router.refresh();
        })
      }
    >
      {title}
    </button>
  );
}
