/**
 * Base email layout template
 * Provides consistent header, footer, and styling for all emails
 */

export interface BaseLayoutOptions {
  title: string;
  preheader?: string; // Preview text in email clients
  showUnsubscribe?: boolean;
  unsubscribeUrl?: string;
}

const BRAND_COLOR = "#2563eb"; // blue-600
const TEXT_COLOR = "#1f2937"; // gray-800
const TEXT_MUTED = "#6b7280"; // gray-500
const BG_COLOR = "#f9fafb"; // gray-50
const CARD_BG = "#ffffff";

export function baseLayout(
  content: string,
  options: BaseLayoutOptions
): string {
  const { title, preheader, showUnsubscribe = true, unsubscribeUrl } = options;

  const preheaderHtml = preheader
    ? `<span style="display: none; max-height: 0; overflow: hidden;">${preheader}</span>`
    : "";

  const unsubscribeHtml =
    showUnsubscribe && unsubscribeUrl
      ? `
        <tr>
          <td align="center" style="padding: 20px 0;">
            <a href="${unsubscribeUrl}" style="color: ${TEXT_MUTED}; font-size: 12px; text-decoration: underline;">
              Unsubscribe from these emails
            </a>
          </td>
        </tr>
      `
      : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style type="text/css">
    /* Reset styles */
    body, table, td { margin: 0; padding: 0; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }

    /* Responsive styles */
    @media screen and (max-width: 600px) {
      .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .mobile-full-width { width: 100% !important; }
    }
  </style>
</head>
<body style="background-color: ${BG_COLOR}; margin: 0; padding: 0;">
  ${preheaderHtml}

  <!-- Main wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_COLOR};">
    <tr>
      <td align="center" style="padding: 40px 0;">

        <!-- Header -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="mobile-full-width">
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <h1 style="margin: 0; color: ${BRAND_COLOR}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 700;">
                CNC Design Library
              </h1>
            </td>
          </tr>
        </table>

        <!-- Content card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="mobile-full-width" style="background-color: ${CARD_BG}; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td class="mobile-padding" style="padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: ${TEXT_COLOR};">
              ${content}
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="mobile-full-width">
          ${unsubscribeHtml}
          <tr>
            <td align="center" style="padding: 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: ${TEXT_MUTED};">
              &copy; ${new Date().getFullYear()} CNC Design Library. All rights reserved.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate a styled button
 */
export function button(text: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center" style="border-radius: 6px; background-color: ${BRAND_COLOR};">
          <a href="${url}" target="_blank" style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Generate a styled info box
 */
export function infoBox(content: string, type: "info" | "warning" | "success" = "info"): string {
  const colors = {
    info: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
    warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
    success: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
  };
  const c = colors[type];

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr>
        <td style="padding: 16px; background-color: ${c.bg}; border-left: 4px solid ${c.border}; border-radius: 4px; color: ${c.text}; font-size: 14px;">
          ${content}
        </td>
      </tr>
    </table>
  `;
}
