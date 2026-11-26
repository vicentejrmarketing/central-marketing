"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionState } from "@/lib/action";

/** Botão que pede confirmação e chama uma server action (com toast de sucesso/erro). */
export function ConfirmActionButton<T>({
  action,
  title,
  description,
  confirmLabel = "Confirmar",
  variant = "outline",
  size = "sm",
  destructive,
  children,
  onDone,
}: {
  action: () => Promise<ActionState<T>>;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  destructive?: boolean;
  children: React.ReactNode;
  onDone?: (state: NonNullable<ActionState<T>>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {children}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div>{description}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await action();
                if (res?.ok) {
                  if (res.message) toast.success(res.message);
                  setOpen(false);
                  onDone?.(res);
                  router.refresh();
                } else if (res?.message) toast.error(res.message);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
