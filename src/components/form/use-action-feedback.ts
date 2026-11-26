"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action";

/** Mostra o resultado da ação (sucesso/erro) uma única vez por resposta. */
export function useActionFeedback<T>(state: ActionState<T>, onSuccess?: (state: NonNullable<ActionState<T>>) => void) {
  const last = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!state || state.at === last.current) return;
    last.current = state.at;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      onSuccess?.(state);
    } else if (state.message) {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
