/**
 * Import completion email template
 */

import { baseLayout, button, infoBox } from "./base-layout";
import type { ImportCompletionData } from "../types";

export function importCompletionEmail(
  data: ImportCompletionData,
  unsubscribeUrl: string
): string {
  const hasErrors = data.failedCount > 0;
  const hasSkipped = data.skippedCount > 0;

  let statusMessage: string;
  let boxType: "info" | "warning" | "success" = "success";

  if (data.failedCount === data.totalItems) {
    statusMessage = "The import failed to process any items.";
    boxType = "warning";
  } else if (hasErrors) {
    statusMessage = `Import completed with ${data.failedCount} error${data.failedCount > 1 ? "s" : ""}.`;
    boxType = "warning";
  } else {
    statusMessage = "Import completed successfully!";
    boxType = "success";
  }

  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
      Import Job Complete
    </h2>

    <p style="margin: 0 0 16px 0;">
      Hi ${data.userName || "there"},
    </p>

    <p style="margin: 0 0 16px 0;">
      Your import job "<strong>${data.jobName}</strong>" has finished processing.
    </p>

    ${infoBox(statusMessage, boxType)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px;">
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Import Summary</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Total Items</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${data.totalItems}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #22c55e;">&#10003;</span> Successful
              </td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #22c55e; font-weight: 600;">${data.successCount}</td>
            </tr>
            ${
              hasErrors
                ? `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #dc2626;">&#10007;</span> Failed
              </td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #dc2626; font-weight: 600;">${data.failedCount}</td>
            </tr>
            `
                : ""
            }
            ${
              hasSkipped
                ? `
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: #f59e0b;">&#8212;</span> Skipped
              </td>
              <td style="padding: 8px 0; text-align: right; color: #f59e0b;">${data.skippedCount}</td>
            </tr>
            `
                : ""
            }
          </table>
        </td>
      </tr>
    </table>

    ${button("View Import Details", data.viewJobUrl)}

    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
      ${
        hasErrors
          ? "Click the button above to view details about the failed items."
          : "Your imported designs are now available in the library."
      }
    </p>
  `;

  return baseLayout(content, {
    title: "Import Job Complete",
    preheader: statusMessage,
    unsubscribeUrl,
  });
}

export function importCompletionEmailText(data: ImportCompletionData): string {
  let statusMessage: string;

  if (data.failedCount === data.totalItems) {
    statusMessage = "The import failed to process any items.";
  } else if (data.failedCount > 0) {
    statusMessage = `Import completed with ${data.failedCount} error(s).`;
  } else {
    statusMessage = "Import completed successfully!";
  }

  return `
Import Job Complete

Hi ${data.userName || "there"},

Your import job "${data.jobName}" has finished processing.

${statusMessage}

--- Import Summary ---
Total Items: ${data.totalItems}
Successful: ${data.successCount}
${data.failedCount > 0 ? `Failed: ${data.failedCount}` : ""}
${data.skippedCount > 0 ? `Skipped: ${data.skippedCount}` : ""}

View Import Details: ${data.viewJobUrl}

${
  data.failedCount > 0
    ? "Visit the link above to view details about the failed items."
    : "Your imported designs are now available in the library."
}

© ${new Date().getFullYear()} CNC Design Library. All rights reserved.
  `.trim();
}
