"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  Ban,
  Shield,
  Crown,
  Clock,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import type { UserStatus, AccessTier } from "@/lib/types";

// =============================================================================
// Base Badge Component
// =============================================================================

interface BaseBadgeProps {
  icon?: LucideIcon;
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple" | "yellow";
  className?: string;
}

const variantStyles = {
  default: "bg-secondary text-foreground",
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  danger: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export function BaseBadge({ icon: Icon, children, variant = "default", className }: BaseBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

// =============================================================================
// User Status Badge
// =============================================================================

interface StatusBadgeProps {
  status: UserStatus;
  className?: string;
}

const statusConfig: Record<UserStatus, { icon: LucideIcon; label: string; variant: BaseBadgeProps["variant"] }> = {
  active: { icon: CheckCircle, label: "Active", variant: "success" },
  suspended: { icon: XCircle, label: "Suspended", variant: "warning" },
  banned: { icon: Ban, label: "Banned", variant: "danger" },
};

/**
 * Badge showing user account status (active, suspended, banned)
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.active;
  return (
    <BaseBadge icon={config.icon} variant={config.variant} className={className}>
      {config.label}
    </BaseBadge>
  );
}

// =============================================================================
// User Role Badge
// =============================================================================

interface RoleBadgeProps {
  role: string;
  className?: string;
}

const roleConfig: Record<string, { icon?: LucideIcon; label: string; variant: BaseBadgeProps["variant"] }> = {
  super_admin: { icon: Crown, label: "Super Admin", variant: "purple" },
  admin: { icon: Shield, label: "Admin", variant: "info" },
  user: { label: "User", variant: "default" },
};

/**
 * Badge showing user role (user, admin, super_admin)
 */
export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = roleConfig[role] || roleConfig.user;
  return (
    <BaseBadge icon={config.icon} variant={config.variant} className={className}>
      {config.label}
    </BaseBadge>
  );
}

// =============================================================================
// Access Tier Badge
// =============================================================================

interface TierBadgeProps {
  tier: AccessTier | null | undefined;
  className?: string;
}

/**
 * Badge showing user's access tier (Free, Pro, Premium, etc.)
 */
export function TierBadge({ tier, className }: TierBadgeProps) {
  if (!tier) {
    return (
      <BaseBadge variant="default" className={className}>
        Free
      </BaseBadge>
    );
  }

  // Map common tier slugs to specific styles
  const tierStyles: Record<string, { icon?: LucideIcon; variant: BaseBadgeProps["variant"] }> = {
    pro: { icon: Crown, variant: "yellow" },
    premium: { icon: Shield, variant: "info" },
    enterprise: { icon: Crown, variant: "purple" },
  };

  const config = tierStyles[tier.slug] || { variant: "default" as const };

  return (
    <BaseBadge icon={config.icon} variant={config.variant} className={className}>
      {tier.name}
    </BaseBadge>
  );
}

// =============================================================================
// Import/Job Status Badge
// =============================================================================

type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

interface JobStatusBadgeProps {
  status: JobStatus;
  className?: string;
}

const jobStatusConfig: Record<JobStatus, { icon: LucideIcon; label: string; variant: BaseBadgeProps["variant"] }> = {
  pending: { icon: Clock, label: "Pending", variant: "default" },
  processing: { icon: Clock, label: "Processing", variant: "info" },
  completed: { icon: CheckCircle, label: "Completed", variant: "success" },
  failed: { icon: XCircle, label: "Failed", variant: "danger" },
  cancelled: { icon: Ban, label: "Cancelled", variant: "warning" },
};

/**
 * Badge showing job/import status
 */
export function JobStatusBadge({ status, className }: JobStatusBadgeProps) {
  const config = jobStatusConfig[status] || jobStatusConfig.pending;
  return (
    <BaseBadge icon={config.icon} variant={config.variant} className={className}>
      {config.label}
    </BaseBadge>
  );
}

// =============================================================================
// Design Status Badge
// =============================================================================

type DesignStatus = "draft" | "published" | "archived" | "review";

interface DesignStatusBadgeProps {
  status: DesignStatus;
  className?: string;
}

const designStatusConfig: Record<DesignStatus, { icon?: LucideIcon; label: string; variant: BaseBadgeProps["variant"] }> = {
  draft: { icon: Clock, label: "Draft", variant: "default" },
  review: { icon: AlertCircle, label: "In Review", variant: "warning" },
  published: { icon: CheckCircle, label: "Published", variant: "success" },
  archived: { icon: Ban, label: "Archived", variant: "default" },
};

/**
 * Badge showing design publish status
 */
export function DesignStatusBadge({ status, className }: DesignStatusBadgeProps) {
  const config = designStatusConfig[status] || designStatusConfig.draft;
  return (
    <BaseBadge icon={config.icon} variant={config.variant} className={className}>
      {config.label}
    </BaseBadge>
  );
}

// =============================================================================
// Generic Badges
// =============================================================================

interface SuccessBadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function SuccessBadge({ children, className }: SuccessBadgeProps) {
  return (
    <BaseBadge icon={CheckCircle} variant="success" className={className}>
      {children}
    </BaseBadge>
  );
}

interface WarningBadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function WarningBadge({ children, className }: WarningBadgeProps) {
  return (
    <BaseBadge icon={AlertCircle} variant="warning" className={className}>
      {children}
    </BaseBadge>
  );
}

interface ErrorBadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function ErrorBadge({ children, className }: ErrorBadgeProps) {
  return (
    <BaseBadge icon={XCircle} variant="danger" className={className}>
      {children}
    </BaseBadge>
  );
}
