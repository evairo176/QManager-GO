import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden shadow-xs",
  {
    variants: {
      variant: {
        default:
          "border-primary/25 bg-gradient-to-b from-primary to-primary/85 text-primary-foreground shadow-primary/20 [a&]:hover:brightness-110",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        success:
          "border-success/25 bg-success/15 text-success-on-surface [a&]:hover:bg-success/90 backdrop-blur-sm",
        info:
          "border-info/25 bg-info/15 text-info-on-surface [a&]:hover:bg-info/90 backdrop-blur-sm",
        warning:
          "border-warning/25 bg-warning/15 text-warning-on-surface [a&]:hover:bg-warning/90 backdrop-blur-sm",
        outline:
          "border-border/70 bg-background/50 text-foreground backdrop-blur-sm [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
