import Link from "next/link";
import {
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Scale,
  XCircle,
  Info,
} from "lucide-react";
import type { DesignLicenseType } from "@/lib/types";

interface LicenseBadgeProps {
  licenseType: DesignLicenseType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

// License display configuration
const LICENSE_CONFIG: Record<
  DesignLicenseType,
  {
    label: string;
    shortLabel: string;
    description: string;
    icon: typeof CheckCircle;
    colorClasses: string;
    bgClasses: string;
  }
> = {
  unknown: {
    label: "Verify Before Use",
    shortLabel: "Unknown",
    description: "License not verified - use at your own risk",
    icon: HelpCircle,
    colorClasses: "text-gray-600 dark:text-gray-400",
    bgClasses: "bg-gray-100 dark:bg-gray-800",
  },
  public_domain: {
    label: "Public Domain",
    shortLabel: "Public Domain",
    description: "No copyright - free for any use",
    icon: CheckCircle,
    colorClasses: "text-green-600 dark:text-green-400",
    bgClasses: "bg-green-100 dark:bg-green-900/30",
  },
  cc0: {
    label: "CC0",
    shortLabel: "CC0",
    description: "No rights reserved - use freely",
    icon: Scale,
    colorClasses: "text-green-600 dark:text-green-400",
    bgClasses: "bg-green-100 dark:bg-green-900/30",
  },
  cc_by: {
    label: "CC BY",
    shortLabel: "CC BY",
    description: "Attribution required",
    icon: Scale,
    colorClasses: "text-blue-600 dark:text-blue-400",
    bgClasses: "bg-blue-100 dark:bg-blue-900/30",
  },
  cc_by_sa: {
    label: "CC BY-SA",
    shortLabel: "CC BY-SA",
    description: "Attribution + ShareAlike required",
    icon: Scale,
    colorClasses: "text-blue-600 dark:text-blue-400",
    bgClasses: "bg-blue-100 dark:bg-blue-900/30",
  },
  cc_by_nc: {
    label: "CC BY-NC",
    shortLabel: "Non-Commercial",
    description: "Non-commercial use only, attribution required",
    icon: AlertTriangle,
    colorClasses: "text-yellow-600 dark:text-yellow-400",
    bgClasses: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  cc_by_nc_sa: {
    label: "CC BY-NC-SA",
    shortLabel: "NC-ShareAlike",
    description: "Non-commercial, attribution + ShareAlike required",
    icon: AlertTriangle,
    colorClasses: "text-yellow-600 dark:text-yellow-400",
    bgClasses: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  personal_only: {
    label: "Personal Use Only",
    shortLabel: "Personal",
    description: "No commercial use allowed",
    icon: XCircle,
    colorClasses: "text-red-600 dark:text-red-400",
    bgClasses: "bg-red-100 dark:bg-red-900/30",
  },
  custom: {
    label: "Custom License",
    shortLabel: "Custom",
    description: "Check license notes for details",
    icon: Info,
    colorClasses: "text-purple-600 dark:text-purple-400",
    bgClasses: "bg-purple-100 dark:bg-purple-900/30",
  },
};

export function LicenseBadge({
  licenseType,
  size = "md",
  showLabel = true,
  className = "",
}: LicenseBadgeProps) {
  const config = LICENSE_CONFIG[licenseType] || LICENSE_CONFIG.unknown;
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-sm px-3 py-1.5",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bgClasses} ${config.colorClasses} ${sizeClasses[size]} ${className}`}
      title={config.description}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{config.shortLabel}</span>}
    </span>
  );
}

// Detailed license info component for design detail pages
interface LicenseInfoProps {
  licenseType: DesignLicenseType;
  licenseNotes?: string | null;
  licenseUrl?: string | null;
  attributionRequired?: boolean;
  commercialUseAllowed?: boolean | null;
  modificationAllowed?: boolean;
}

export function LicenseInfo({
  licenseType,
  licenseNotes,
  licenseUrl,
  attributionRequired = false,
  commercialUseAllowed,
  modificationAllowed = true,
}: LicenseInfoProps) {
  const config = LICENSE_CONFIG[licenseType] || LICENSE_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <div className={`rounded-lg p-4 ${config.bgClasses}`}>
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg bg-white/50 dark:bg-black/20 flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={`h-5 w-5 ${config.colorClasses}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`font-semibold ${config.colorClasses}`}>
              {config.label}
            </h3>
            {licenseUrl && (
              <a
                href={licenseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                View full license
              </a>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {config.description}
          </p>

          {/* Usage indicators */}
          <div className="flex flex-wrap gap-2 mt-3">
            {commercialUseAllowed === true && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                <CheckCircle className="h-3 w-3" />
                Commercial OK
              </span>
            )}
            {commercialUseAllowed === false && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                <XCircle className="h-3 w-3" />
                No Commercial
              </span>
            )}
            {attributionRequired && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                <Info className="h-3 w-3" />
                Attribution Required
              </span>
            )}
            {modificationAllowed && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-secondary text-muted-foreground rounded">
                <CheckCircle className="h-3 w-3" />
                Modifications OK
              </span>
            )}
          </div>

          {/* License notes */}
          {licenseNotes && (
            <p className="text-sm text-muted-foreground mt-3 p-2 bg-white/50 dark:bg-black/20 rounded">
              {licenseNotes}
            </p>
          )}

          {/* Link to license page */}
          <Link
            href="/license"
            className="text-xs text-primary hover:underline mt-3 inline-block"
          >
            Learn more about licenses
          </Link>
        </div>
      </div>
    </div>
  );
}

// Helper to check if commercial use is likely allowed
export function isCommerciallyUsable(licenseType: DesignLicenseType): boolean {
  return ["public_domain", "cc0", "cc_by", "cc_by_sa"].includes(licenseType);
}

// Helper to check if license is verified
export function isLicenseVerified(licenseType: DesignLicenseType): boolean {
  return licenseType !== "unknown";
}
