/**
 * Email Template Service
 * Manages editable email templates stored in the database
 */

import { createServiceClient } from "@/lib/supabase/server";
import { baseLayout, button, infoBox } from "./templates/base-layout";

// Types
export interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  subject: string;
  html_content: string;
  text_content: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateTemplateInput {
  subject?: string;
  html_content?: string;
  text_content?: string;
  is_active?: boolean;
}

export interface PreviewResult {
  subject: string;
  html: string;
  text: string;
}

// Template variable definitions with sample values for preview
export const TEMPLATE_SAMPLE_DATA: Record<string, Record<string, string>> = {
  welcome: {
    userName: "John Doe",
    loginUrl: "https://example.com/login",
  },
  subscription_confirmation: {
    userName: "John Doe",
    tierName: "Professional",
    tierDescription: "Unlimited downloads and priority support",
    amount: "$9.99/month",
    nextBillingDate: "January 15, 2025",
    manageSubscriptionUrl: "https://example.com/account",
  },
  subscription_expiring: {
    userName: "John Doe",
    tierName: "Professional",
    expirationDate: "January 31, 2025",
    renewUrl: "https://example.com/renew",
  },
  download_limit_warning: {
    userName: "John Doe",
    percentUsed: "85",
    currentUsage: "85",
    limit: "100",
    upgradeUrl: "https://example.com/upgrade",
  },
  account_status_change: {
    userName: "John Doe",
    statusTitle: "Account Reactivated",
    statusMessage: "Great news! Your account has been reactivated.",
    statusInfo: "You now have full access to all features. Welcome back!",
    contactEmail: "support@example.com",
  },
  import_completion: {
    userName: "John Doe",
    jobName: "Design Batch 2025-01",
    statusMessage: "Import completed successfully!",
    totalItems: "150",
    successCount: "148",
    failedCount: "2",
    skippedCount: "0",
    viewJobUrl: "https://example.com/admin/import/123",
  },
  admin_broadcast: {
    title: "Important Platform Update",
    message: "We are excited to announce new features coming soon!",
    actionLabel: "Learn More",
    actionUrl: "https://example.com/updates",
  },
};

// Cache for templates
let templatesCache: Map<string, EmailTemplate> | null = null;
let templatesCacheTime = 0;
const CACHE_TTL = 300000; // 5 minutes

/**
 * Clear the templates cache
 */
export function clearEmailTemplatesCache(): void {
  templatesCache = null;
  templatesCacheTime = 0;
}

/**
 * Get all email templates
 */
export async function getAllTemplates(): Promise<EmailTemplate[]> {
  const now = Date.now();

  // Check cache
  if (templatesCache && now - templatesCacheTime < CACHE_TTL) {
    return Array.from(templatesCache.values());
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("template_key");

  if (error) {
    throw new Error(`Failed to fetch templates: ${error.message}`);
  }

  // Update cache
  templatesCache = new Map();
  for (const template of data || []) {
    templatesCache.set(template.template_key, {
      ...template,
      variables: Array.isArray(template.variables) ? template.variables : JSON.parse(template.variables || "[]"),
    });
  }
  templatesCacheTime = now;

  return Array.from(templatesCache.values());
}

/**
 * Get a single template by key
 */
export async function getTemplate(key: string): Promise<EmailTemplate | null> {
  // Try cache first
  if (templatesCache && Date.now() - templatesCacheTime < CACHE_TTL) {
    return templatesCache.get(key) || null;
  }

  // Fetch all templates (will populate cache)
  await getAllTemplates();

  return templatesCache?.get(key) || null;
}

/**
 * Update a template
 */
export async function updateTemplate(
  key: string,
  input: UpdateTemplateInput
): Promise<EmailTemplate> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("email_templates")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("template_key", key)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update template: ${error.message}`);
  }

  // Clear cache
  clearEmailTemplatesCache();

  return {
    ...data,
    variables: Array.isArray(data.variables) ? data.variables : JSON.parse(data.variables || "[]"),
  };
}

/**
 * Reset a template to its default content
 */
export async function resetTemplateToDefault(key: string): Promise<EmailTemplate> {
  const defaultTemplate = getDefaultTemplate(key);

  if (!defaultTemplate) {
    throw new Error(`No default template found for key: ${key}`);
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("email_templates")
    .update({
      subject: defaultTemplate.subject,
      html_content: defaultTemplate.html_content,
      text_content: defaultTemplate.text_content,
      updated_at: new Date().toISOString(),
    })
    .eq("template_key", key)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to reset template: ${error.message}`);
  }

  // Clear cache
  clearEmailTemplatesCache();

  return {
    ...data,
    variables: Array.isArray(data.variables) ? data.variables : JSON.parse(data.variables || "[]"),
  };
}

/**
 * Preview a template with sample or provided data
 */
export async function previewTemplate(
  key: string,
  data?: Record<string, string>
): Promise<PreviewResult> {
  const template = await getTemplate(key);

  if (!template) {
    throw new Error(`Template not found: ${key}`);
  }

  // Use provided data or sample data
  const variables = data || TEMPLATE_SAMPLE_DATA[key] || {};

  // Replace variables in subject
  let subject = template.subject;
  let htmlContent = template.html_content;
  let textContent = template.text_content;

  // Replace simple variables
  for (const [varName, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${varName}\\}\\}`, "g");
    subject = subject.replace(regex, value);
    htmlContent = htmlContent.replace(regex, value);
    textContent = textContent.replace(regex, value);
  }

  // Handle special button placeholders
  htmlContent = htmlContent.replace(
    /\{\{buttonStartBrowsing\}\}/g,
    button("Start Browsing", variables.loginUrl || "#")
  );
  htmlContent = htmlContent.replace(
    /\{\{buttonManageSubscription\}\}/g,
    button("Manage Subscription", variables.manageSubscriptionUrl || "#")
  );
  htmlContent = htmlContent.replace(
    /\{\{buttonRenew\}\}/g,
    button("Renew Subscription", variables.renewUrl || "#")
  );
  htmlContent = htmlContent.replace(
    /\{\{buttonUpgrade\}\}/g,
    button("Upgrade Your Plan", variables.upgradeUrl || "#")
  );
  htmlContent = htmlContent.replace(
    /\{\{buttonViewDetails\}\}/g,
    button("View Import Details", variables.viewJobUrl || "#")
  );
  htmlContent = htmlContent.replace(
    /\{\{actionButton\}\}/g,
    variables.actionUrl && variables.actionLabel
      ? button(variables.actionLabel, variables.actionUrl)
      : ""
  );

  // Handle special info box placeholders
  htmlContent = htmlContent.replace(
    /\{\{tierDescriptionBox\}\}/g,
    variables.tierDescription ? infoBox(variables.tierDescription, "success") : ""
  );
  htmlContent = htmlContent.replace(
    /\{\{warningBox\}\}/g,
    infoBox(
      "<strong>What happens after expiration:</strong><br>You'll lose access to premium features including unlimited downloads and exclusive designs.",
      "warning"
    )
  );
  htmlContent = htmlContent.replace(
    /\{\{infoBox\}\}/g,
    infoBox(
      "Your download limit resets at the beginning of each billing cycle. Consider upgrading to a higher tier for more downloads.",
      "info"
    )
  );
  htmlContent = htmlContent.replace(
    /\{\{statusBox\}\}/g,
    infoBox(variables.statusInfo || "Your account status has been updated.", "info")
  );

  // Handle dynamic table rows
  htmlContent = htmlContent.replace(
    /\{\{amountRow\}\}/g,
    variables.amount
      ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Amount</td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${variables.amount}</td></tr>`
      : ""
  );
  htmlContent = htmlContent.replace(
    /\{\{nextBillingRow\}\}/g,
    variables.nextBillingDate
      ? `<tr><td style="padding: 8px 0;">Next billing date</td><td style="padding: 8px 0; text-align: right;">${variables.nextBillingDate}</td></tr>`
      : ""
  );
  htmlContent = htmlContent.replace(
    /\{\{failedRow\}\}/g,
    variables.failedCount && variables.failedCount !== "0"
      ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><span style="color: #dc2626;">&#10007;</span> Failed</td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #dc2626; font-weight: 600;">${variables.failedCount}</td></tr>`
      : ""
  );
  htmlContent = htmlContent.replace(
    /\{\{skippedRow\}\}/g,
    variables.skippedCount && variables.skippedCount !== "0"
      ? `<tr><td style="padding: 8px 0;"><span style="color: #f59e0b;">&#8212;</span> Skipped</td><td style="padding: 8px 0; text-align: right; color: #f59e0b;">${variables.skippedCount}</td></tr>`
      : ""
  );

  // Handle progress bar for download limit
  const percentUsed = parseInt(variables.percentUsed || "0", 10);
  const percentColor =
    percentUsed >= 90 ? "#dc2626" : percentUsed >= 80 ? "#f59e0b" : "#22c55e";
  htmlContent = htmlContent.replace(/\{\{percentColor\}\}/g, percentColor);
  htmlContent = htmlContent.replace(
    /\{\{progressBar\}\}/g,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
      <tr><td style="background-color: #e5e7eb; border-radius: 4px; height: 8px;">
        <table role="presentation" width="${Math.min(percentUsed, 100)}%" cellpadding="0" cellspacing="0">
          <tr><td style="background-color: ${percentColor}; border-radius: 4px; height: 8px;">&nbsp;</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding-top: 8px; font-size: 14px; color: #6b7280;">
        ${variables.currentUsage || "0"} of ${variables.limit || "100"} downloads used this month
      </td></tr>
    </table>`
  );

  // Handle footer message
  htmlContent = htmlContent.replace(
    /\{\{footerMessage\}\}/g,
    variables.failedCount && variables.failedCount !== "0"
      ? "Click the button above to view details about the failed items."
      : "Your imported designs are now available in the library."
  );

  // Handle action link for text version
  textContent = textContent.replace(
    /\{\{actionLink\}\}/g,
    variables.actionUrl && variables.actionLabel
      ? `${variables.actionLabel}: ${variables.actionUrl}`
      : ""
  );

  // Wrap HTML content in base layout
  const fullHtml = baseLayout(htmlContent, {
    title: subject,
    preheader: subject,
    unsubscribeUrl: "https://example.com/unsubscribe?token=preview",
  });

  return {
    subject,
    html: fullHtml,
    text: textContent,
  };
}

/**
 * Get the default template content for a key
 * This returns the original hardcoded template
 */
export function getDefaultTemplate(
  key: string
): { subject: string; html_content: string; text_content: string } | null {
  // These are the default templates that match the seeded data
  const defaults: Record<string, { subject: string; html_content: string; text_content: string }> = {
    welcome: {
      subject: "Welcome to CNC Design Library, {{userName}}!",
      html_content: `<h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
  Welcome to CNC Design Library!
</h2>

<p style="margin: 0 0 16px 0;">
  Hi {{userName}},
</p>

<p style="margin: 0 0 16px 0;">
  Thank you for joining CNC Design Library! We're excited to have you as part of our community.
</p>

<p style="margin: 0 0 16px 0;">
  With your account, you can:
</p>

<ul style="margin: 0 0 16px 0; padding-left: 24px;">
  <li style="margin-bottom: 8px;">Browse thousands of CNC and laser cutting designs</li>
  <li style="margin-bottom: 8px;">Download files in multiple formats (SVG, DXF, STL, and more)</li>
  <li style="margin-bottom: 8px;">Save your favorite designs to collections</li>
  <li style="margin-bottom: 8px;">Track your download history</li>
</ul>

{{buttonStartBrowsing}}

<p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
  If you have any questions, feel free to reach out to our support team.
</p>`,
      text_content: `Welcome to CNC Design Library!

Hi {{userName}},

Thank you for joining CNC Design Library! We're excited to have you as part of our community.

With your account, you can:
- Browse thousands of CNC and laser cutting designs
- Download files in multiple formats (SVG, DXF, STL, and more)
- Save your favorite designs to collections
- Track your download history

Start Browsing: {{loginUrl}}

If you have any questions, feel free to reach out to our support team.`,
    },
    // Add other default templates as needed
  };

  return defaults[key] || null;
}

/**
 * Get template variable definitions for documentation
 */
export function getTemplateVariables(key: string): { name: string; description: string }[] {
  const variableDefinitions: Record<string, { name: string; description: string }[]> = {
    welcome: [
      { name: "userName", description: "The user's display name" },
      { name: "loginUrl", description: "URL to the login page" },
    ],
    subscription_confirmation: [
      { name: "userName", description: "The user's display name" },
      { name: "tierName", description: "Name of the subscription tier" },
      { name: "tierDescription", description: "Description of tier benefits" },
      { name: "amount", description: "Subscription amount (e.g., '$9.99/month')" },
      { name: "nextBillingDate", description: "Next billing date" },
      { name: "manageSubscriptionUrl", description: "URL to manage subscription" },
    ],
    subscription_expiring: [
      { name: "userName", description: "The user's display name" },
      { name: "tierName", description: "Name of the subscription tier" },
      { name: "expirationDate", description: "Subscription expiration date" },
      { name: "renewUrl", description: "URL to renew subscription" },
    ],
    download_limit_warning: [
      { name: "userName", description: "The user's display name" },
      { name: "percentUsed", description: "Percentage of limit used (e.g., '85')" },
      { name: "currentUsage", description: "Current download count" },
      { name: "limit", description: "Total download limit" },
      { name: "upgradeUrl", description: "URL to upgrade plan" },
    ],
    account_status_change: [
      { name: "userName", description: "The user's display name" },
      { name: "statusTitle", description: "Title for the status change" },
      { name: "statusMessage", description: "Main status message" },
      { name: "statusInfo", description: "Additional information about the change" },
      { name: "contactEmail", description: "Support email address" },
    ],
    import_completion: [
      { name: "userName", description: "The user's display name" },
      { name: "jobName", description: "Name of the import job" },
      { name: "statusMessage", description: "Status message (success/error)" },
      { name: "totalItems", description: "Total items in job" },
      { name: "successCount", description: "Successfully imported count" },
      { name: "failedCount", description: "Failed import count" },
      { name: "skippedCount", description: "Skipped items count" },
      { name: "viewJobUrl", description: "URL to view job details" },
    ],
    admin_broadcast: [
      { name: "title", description: "Broadcast title" },
      { name: "message", description: "Main message content" },
      { name: "actionLabel", description: "Call-to-action button text (optional)" },
      { name: "actionUrl", description: "Call-to-action URL (optional)" },
    ],
  };

  return variableDefinitions[key] || [];
}
