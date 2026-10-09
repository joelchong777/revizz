import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-2xl border-2 px-2.5 py-0.5 text-xs font-black transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none shadow-xs",
  {
    variants: {
      variant: {
        default:
          "border-amber-400 bg-brand-yellow text-amber-950 shadow-xs",
        secondary:
          "border-slate-300 bg-slate-100 text-slate-800",
        destructive:
          "border-rose-300 bg-rose-100 text-rose-800",
        outline:
          "border-slate-300 bg-white text-slate-700",
        teal:
          "border-teal-300 bg-teal-50 text-teal-800",
        coral:
          "border-rose-300 bg-rose-50 text-rose-800",
        indigo:
          "border-indigo-300 bg-indigo-50 text-indigo-800",
        green:
          "border-emerald-300 bg-emerald-50 text-emerald-800",
        amber:
          "border-amber-300 bg-amber-50 text-amber-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
