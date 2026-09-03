"use client";

import React from "react";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { containerVariants, itemVariants } from "@/lib/motion";
import { cn } from "@/lib/utils";

// =============================================================================
// PageHeader — shared GSAP-web style page header.
// =============================================================================
// Every routed section opens with the same silhouette: a tinted icon badge,
// a bold gradient-capable title, a muted one-line description, and an
// optional action slot. The whole cluster mounts with the reference expo
// curve (fade-up + optical deblur) so every section feels like one
// instrument, and actions sit optically right-aligned on desktop while
// stacking under the copy on mobile.
// =============================================================================

interface PageHeaderProps {
  /** Lucide icon rendered inside the tinted badge. */
  icon: LucideIcon;
  /** Section title (plain string or i18n-resolved string). */
  title: string;
  /** Optional muted one-line description. */
  description?: string;
  /** Optional trailing action cluster (buttons, toggles, pills). */
  action?: React.ReactNode;
  /** Optional icon badge tint class (defaults to primary/10 + primary text). */
  iconClassName?: string;
  className?: string;
  /** Skip the entrance motion (e.g. nested/static contexts). */
  static?: boolean;
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  action,
  iconClassName,
  className,
  static: isStatic,
}: PageHeaderProps) {
  const content = (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <motion.div
        variants={containerVariants}
        initial={isStatic ? false : "hidden"}
        animate="visible"
        className="flex items-start gap-3.5 min-w-0"
      >
        <motion.div
          variants={itemVariants}
          className={cn(
            "mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-transform duration-300 hover:scale-105",
            iconClassName ??
              "border-primary/20 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/15",
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </motion.div>

        <div className="min-w-0">
          <motion.h1
            variants={itemVariants}
            className="text-xl font-bold tracking-tight sm:text-2xl bg-gradient-to-br from-foreground to-foreground/80 bg-clip-text text-transparent"
          >
            {title}
          </motion.h1>
          {description && (
            <motion.p
              variants={itemVariants}
              className="mt-1 text-sm leading-relaxed text-muted-foreground"
            >
              {description}
            </motion.p>
          )}
        </div>
      </motion.div>

      {action && (
        <motion.div
          variants={itemVariants}
          initial={isStatic ? false : "hidden"}
          animate="visible"
          className="flex shrink-0 items-center gap-2"
        >
          {action}
        </motion.div>
      )}
    </div>
  );

  if (isStatic) return content;
  return content;
}