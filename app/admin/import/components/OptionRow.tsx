"use client";

/**
 * OptionRow Component
 *
 * Reusable option row for the import wizard's core settings.
 * Displays a checkbox with icon, label, description, and optional badge.
 *
 * Created: 2025-12-26
 * AI Model: Claude Opus 4.5 (claude-opus-4-5-20251101)
 */

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface OptionRowProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  badge?: string;
  disabled?: boolean;
}

export function OptionRow({
  id,
  icon,
  label,
  description,
  checked,
  onChange,
  badge,
  disabled,
}: OptionRowProps) {
  return (
    <div className="flex items-start space-x-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(checked) => onChange(!!checked)}
        disabled={disabled}
        className="mt-1"
      />
      <div className="grid gap-1 flex-1">
        <Label
          htmlFor={id}
          className={`flex items-center gap-2 cursor-pointer ${disabled ? "opacity-50" : ""}`}
        >
          {icon}
          {label}
          {badge && (
            <Badge variant="secondary" className="text-xs font-normal">
              {badge}
            </Badge>
          )}
        </Label>
        <p className={`text-xs text-muted-foreground ${disabled ? "opacity-50" : ""}`}>
          {description}
        </p>
      </div>
    </div>
  );
}
