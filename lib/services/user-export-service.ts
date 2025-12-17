/**
 * User Export Service
 * Export user data to CSV/JSON for marketing systems
 */

import { createServiceClient } from "@/lib/supabase/server";

// Types
export interface ExportField {
  key: string;
  label: string;
  description: string;
  category: "basic" | "subscription" | "activity" | "preferences";
}

export interface ExportOptions {
  fields?: string[];
  filters?: {
    status?: string[];
    role?: string[];
    subscribedOnly?: boolean; // email_unsubscribed = false
    hasActiveSubscription?: boolean;
    createdAfter?: string;
    createdBefore?: string;
  };
  format?: "csv" | "json";
}

export interface ExportResult {
  data: string;
  count: number;
  format: "csv" | "json";
  filename: string;
}

// Available export fields
export const EXPORTABLE_FIELDS: ExportField[] = [
  // Basic info
  { key: "id", label: "User ID", description: "Unique user identifier", category: "basic" },
  { key: "email", label: "Email", description: "User email address", category: "basic" },
  { key: "full_name", label: "Full Name", description: "User's full name", category: "basic" },
  { key: "display_name", label: "Display Name", description: "Public display name", category: "basic" },
  { key: "role", label: "Role", description: "User role (user, admin, super_admin)", category: "basic" },
  { key: "status", label: "Status", description: "Account status (active, suspended, etc.)", category: "basic" },
  { key: "created_at", label: "Created At", description: "Account creation date", category: "basic" },
  { key: "last_login_at", label: "Last Login", description: "Last login timestamp", category: "basic" },

  // Subscription info
  { key: "subscription_tier", label: "Subscription Tier", description: "Current subscription tier", category: "subscription" },
  { key: "subscription_status", label: "Subscription Status", description: "Subscription status", category: "subscription" },
  { key: "subscription_expires_at", label: "Subscription Expires", description: "Subscription expiration date", category: "subscription" },
  { key: "stripe_customer_id", label: "Stripe Customer ID", description: "Stripe customer identifier", category: "subscription" },

  // Activity
  { key: "download_count", label: "Download Count", description: "Total downloads", category: "activity" },
  { key: "download_limit", label: "Download Limit", description: "Monthly download limit", category: "activity" },

  // Email preferences
  { key: "email_unsubscribed", label: "Unsubscribed", description: "Globally unsubscribed from emails", category: "preferences" },
  { key: "email_welcome", label: "Welcome Emails", description: "Opted into welcome emails", category: "preferences" },
  { key: "email_subscription_confirmation", label: "Subscription Emails", description: "Opted into subscription emails", category: "preferences" },
  { key: "email_subscription_expiring", label: "Expiration Reminders", description: "Opted into expiration reminders", category: "preferences" },
  { key: "email_download_limit_warning", label: "Limit Warnings", description: "Opted into download limit warnings", category: "preferences" },
  { key: "email_account_status_change", label: "Account Updates", description: "Opted into account status emails", category: "preferences" },
  { key: "email_import_completion", label: "Import Emails", description: "Opted into import completion emails", category: "preferences" },
  { key: "email_admin_broadcast", label: "Announcements", description: "Opted into admin announcements", category: "preferences" },
];

// Default fields for export
const DEFAULT_FIELDS = [
  "email",
  "full_name",
  "display_name",
  "role",
  "status",
  "subscription_tier",
  "subscription_status",
  "created_at",
  "email_unsubscribed",
];

/**
 * Get list of exportable fields grouped by category
 */
export function getExportableFields(): Record<string, ExportField[]> {
  const grouped: Record<string, ExportField[]> = {
    basic: [],
    subscription: [],
    activity: [],
    preferences: [],
  };

  for (const field of EXPORTABLE_FIELDS) {
    grouped[field.category].push(field);
  }

  return grouped;
}

/**
 * Get count of users matching the filters
 */
export async function getUserExportCount(options: ExportOptions = {}): Promise<number> {
  const supabase = createServiceClient();

  let query = supabase.from("users").select("id", { count: "exact", head: true });

  // Apply filters
  query = applyFilters(query, options.filters);

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count users: ${error.message}`);
  }

  return count || 0;
}

/**
 * Export users to CSV or JSON
 */
export async function exportUsers(options: ExportOptions = {}): Promise<ExportResult> {
  const supabase = createServiceClient();
  const format = options.format || "csv";
  const fields = options.fields?.length ? options.fields : DEFAULT_FIELDS;

  // Validate fields
  const validFields = fields.filter((f) =>
    EXPORTABLE_FIELDS.some((ef) => ef.key === f)
  );

  if (validFields.length === 0) {
    throw new Error("No valid fields selected for export");
  }

  // Build select string - handle email preferences from user_email_preferences table
  const userFields = validFields.filter(
    (f) => !f.startsWith("email_") || f === "email"
  );
  const emailPrefFields = validFields.filter(
    (f) => f.startsWith("email_") && f !== "email"
  );

  // Build query for users
  let query = supabase.from("users").select(userFields.join(","));

  // Apply filters
  query = applyFilters(query, options.filters);

  // Order by creation date
  query = query.order("created_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await query;
  // Cast to any since fields are dynamic
  const users = data as Record<string, unknown>[] | null;

  if (error) {
    throw new Error(`Failed to export users: ${error.message}`);
  }

  if (!users || users.length === 0) {
    return {
      data: format === "csv" ? getCSVHeader(validFields) : "[]",
      count: 0,
      format,
      filename: getExportFilename(format),
    };
  }

  // If we need email preferences, fetch them
  let emailPrefsMap = new Map<string, Record<string, boolean>>();

  if (emailPrefFields.length > 0) {
    const userIds = users.map((u) => u.id as string);
    const { data: prefsData, error: prefsError } = await supabase
      .from("user_email_preferences")
      .select("user_id," + emailPrefFields.join(","))
      .in("user_id", userIds);

    // Cast to any since fields are dynamic
    const prefs = prefsData as Record<string, unknown>[] | null;

    if (!prefsError && prefs) {
      for (const pref of prefs) {
        emailPrefsMap.set(pref.user_id as string, pref as Record<string, boolean>);
      }
    }
  }

  // Merge user data with email preferences
  const exportData = users.map((user) => {
    const row: Record<string, unknown> = {};

    for (const field of validFields) {
      if (field.startsWith("email_") && field !== "email") {
        // Get from email preferences
        const prefs = emailPrefsMap.get(user.id as string);
        row[field] = prefs?.[field] ?? true; // Default to true if not set
      } else {
        row[field] = user[field];
      }
    }

    return row;
  });

  // Format output
  let output: string;

  if (format === "json") {
    output = JSON.stringify(exportData, null, 2);
  } else {
    output = convertToCSV(exportData, validFields);
  }

  return {
    data: output,
    count: exportData.length,
    format,
    filename: getExportFilename(format),
  };
}

/**
 * Apply filters to query
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters<T>(query: T, filters?: ExportOptions["filters"]): T {
  if (!filters) return query;

  // Cast to any for filter methods since Supabase types are complex
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;

  if (filters.status?.length) {
    q = q.in("status", filters.status);
  }

  if (filters.role?.length) {
    q = q.in("role", filters.role);
  }

  if (filters.createdAfter) {
    q = q.gte("created_at", filters.createdAfter);
  }

  if (filters.createdBefore) {
    q = q.lte("created_at", filters.createdBefore);
  }

  if (filters.hasActiveSubscription) {
    q = q.eq("subscription_status", "active");
  }

  return q as T;
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data: Record<string, unknown>[], fields: string[]): string {
  const rows: string[] = [];

  // Header row with field labels
  const header = fields.map((f) => {
    const field = EXPORTABLE_FIELDS.find((ef) => ef.key === f);
    return escapeCSVValue(field?.label || f);
  });
  rows.push(header.join(","));

  // Data rows
  for (const item of data) {
    const row = fields.map((f) => {
      const value = item[f];
      return escapeCSVValue(formatValue(value));
    });
    rows.push(row.join(","));
  }

  return rows.join("\n");
}

/**
 * Get CSV header only
 */
function getCSVHeader(fields: string[]): string {
  const header = fields.map((f) => {
    const field = EXPORTABLE_FIELDS.find((ef) => ef.key === f);
    return escapeCSVValue(field?.label || f);
  });
  return header.join(",");
}

/**
 * Escape a value for CSV
 */
function escapeCSVValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format a value for export
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Generate export filename
 */
function getExportFilename(format: "csv" | "json"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `users-export-${date}.${format}`;
}

/**
 * Stream export for large datasets (async generator)
 */
export async function* streamExportUsers(
  options: ExportOptions = {}
): AsyncGenerator<string> {
  const supabase = createServiceClient();
  const format = options.format || "csv";
  const fields = options.fields?.length ? options.fields : DEFAULT_FIELDS;
  const pageSize = 1000;
  let offset = 0;

  // Validate fields
  const validFields = fields.filter((f) =>
    EXPORTABLE_FIELDS.some((ef) => ef.key === f)
  );

  if (validFields.length === 0) {
    throw new Error("No valid fields selected for export");
  }

  // For JSON, yield opening bracket
  if (format === "json") {
    yield "[\n";
  } else {
    // Yield CSV header
    yield getCSVHeader(validFields) + "\n";
  }

  let isFirst = true;
  let hasMore = true;

  while (hasMore) {
    // Build query
    const userFields = validFields.filter(
      (f) => !f.startsWith("email_") || f === "email"
    );
    const emailPrefFields = validFields.filter(
      (f) => f.startsWith("email_") && f !== "email"
    );

    let query = supabase
      .from("users")
      .select(userFields.join(","))
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    query = applyFilters(query, options.filters);

    const { data, error } = await query;
    // Cast to any since fields are dynamic
    const users = data as Record<string, unknown>[] | null;

    if (error) {
      throw new Error(`Failed to export users: ${error.message}`);
    }

    if (!users || users.length === 0) {
      hasMore = false;
      continue;
    }

    // Fetch email preferences if needed
    let emailPrefsMap = new Map<string, Record<string, boolean>>();

    if (emailPrefFields.length > 0) {
      const userIds = users.map((u) => u.id as string);
      const { data: prefsData } = await supabase
        .from("user_email_preferences")
        .select("user_id," + emailPrefFields.join(","))
        .in("user_id", userIds);

      const prefs = prefsData as Record<string, unknown>[] | null;
      if (prefs) {
        for (const pref of prefs) {
          emailPrefsMap.set(pref.user_id as string, pref as Record<string, boolean>);
        }
      }
    }

    // Process and yield each user
    for (const user of users) {
      const row: Record<string, unknown> = {};

      for (const field of validFields) {
        if (field.startsWith("email_") && field !== "email") {
          const prefs = emailPrefsMap.get(user.id as string);
          row[field] = prefs?.[field] ?? true;
        } else {
          row[field] = user[field];
        }
      }

      if (format === "json") {
        const prefix = isFirst ? "  " : ",\n  ";
        yield prefix + JSON.stringify(row);
        isFirst = false;
      } else {
        const csvRow = validFields.map((f) => escapeCSVValue(formatValue(row[f])));
        yield csvRow.join(",") + "\n";
      }
    }

    hasMore = users.length === pageSize;
    offset += pageSize;
  }

  // For JSON, yield closing bracket
  if (format === "json") {
    yield "\n]";
  }
}
