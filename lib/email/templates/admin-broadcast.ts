/**
 * Admin broadcast email template
 */

import { baseLayout, button } from "./base-layout";
import type { AdminBroadcastData } from "../types";

export function adminBroadcastEmail(
  data: AdminBroadcastData,
  unsubscribeUrl: string
): string {
  const actionButton = data.actionUrl && data.actionLabel
    ? button(data.actionLabel, data.actionUrl)
    : "";

  // Convert newlines to <br> tags for HTML
  const formattedMessage = data.message
    .replace(/\n\n/g, "</p><p style=\"margin: 0 0 16px 0;\">")
    .replace(/\n/g, "<br>");

  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
      ${data.title}
    </h2>

    <p style="margin: 0 0 16px 0;">
      ${formattedMessage}
    </p>

    ${actionButton}

    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
      This message was sent to all members of CNC Design Library.
    </p>
  `;

  return baseLayout(content, {
    title: data.title,
    preheader: data.message.slice(0, 100) + (data.message.length > 100 ? "..." : ""),
    unsubscribeUrl,
  });
}

export function adminBroadcastEmailText(data: AdminBroadcastData): string {
  const actionLink = data.actionUrl && data.actionLabel
    ? `\n${data.actionLabel}: ${data.actionUrl}\n`
    : "";

  return `
${data.title}

${data.message}
${actionLink}
---
This message was sent to all members of CNC Design Library.

© ${new Date().getFullYear()} CNC Design Library. All rights reserved.
  `.trim();
}
