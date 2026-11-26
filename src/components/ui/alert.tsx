import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative flex w-full gap-3 rounded-lg border px-4 py-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", {
  variants: {
    variant: {
      default: "bg-card",
      info: "border-primary/20 bg-primary/5 [&>svg]:text-primary",
      warning: "border-warning/40 bg-warning/10 [&>svg]:text-[oklch(0.55_0.13_70)]",
      destructive: "border-destructive/30 bg-destructive/5 text-destructive",
      success: "border-success/30 bg-success/5 [&>svg]:text-success",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export { Alert };
