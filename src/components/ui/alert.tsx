import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex gap-3 rounded-2xl border p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0", {
  variants: {
    variant: {
      default: "border-border bg-card text-foreground",
      info: "border-accent/50 bg-secondary text-secondary-foreground",
      destructive: "border-destructive/30 bg-destructive/5 text-destructive",
      warning: "border-warning/30 bg-warning-soft text-warning",
      success: "border-success/30 bg-success-soft text-success",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export { Alert };
