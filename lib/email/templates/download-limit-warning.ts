/**
 * Download limit warning email template
 */

import { baseLayout, button, infoBox } from "./base-layout";
import type { DownloadLimitWarningData } from "../types";

export function downloadLimitWarningEmail(
  data: DownloadLimitWarningData,
  unsubscribeUrl: string
): string {
  const percentColor =
    data.percentUsed >= 90 ? "#dc2626" : data.percentUsed >= 80 ? "#f59e0b" : "#22c55e";

  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
      Download Limit Warning
    </h2>

    <p style="margin: 0 0 16px 0;">
      Hi ${data.userName || "there"},
    </p>

    <p style="margin: 0 0 24px 0;">
      You've used <strong style="color: ${percentColor};">${data.percentUsed}%</strong> of your monthly download limit.
    </p>

    <!-- Progress bar -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
      <tr>
        <td style="background-color: #e5e7eb; border-radius: 4px; height: 8px;">
          <table role="presentation" width="${Math.min(data.percentUsed, 100)}%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background-color: ${percentColor}; border-radius: 4px; height: 8px;">&nbsp;</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 8px; font-size: 14px; color: #6b7280;">
          ${data.currentUsage} of ${data.limit} downloads used this month
        </td>
      </tr>
    </table>

    ${infoBox(
      `Your download limit resets at the beginning of each billing cycle.
       Consider upgrading to a higher tier for more downloads.`,
      "info"
    )}

    ${button("Upgrade Your Plan", data.upgradeUrl)}

    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
      Need more downloads right now? Upgrading your plan takes effect immediately.
    </p>
  `;

  return baseLayout(content, {
    title: "Download Limit Warning",
    preheader: `You've used ${data.percentUsed}% of your monthly downloads`,
    unsubscribeUrl,
  });
}

export function downloadLimitWarningEmailText(
  data: DownloadLimitWarningData
): string {
  return `
Download Limit Warning

Hi ${data.userName || "there"},

You've used ${data.percentUsed}% of your monthly download limit.

${data.currentUsage} of ${data.limit} downloads used this month.

Your download limit resets at the beginning of each billing cycle.
Consider upgrading to a higher tier for more downloads.

Upgrade Your Plan: ${data.upgradeUrl}

Need more downloads right now? Upgrading your plan takes effect immediately.

© ${new Date().getFullYear()} CNC Design Library. All rights reserved.
  `.trim();
}
