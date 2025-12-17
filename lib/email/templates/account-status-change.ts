/**
 * Account status change email template
 */

import { baseLayout, infoBox } from "./base-layout";
import type { AccountStatusChangeData } from "../types";

export function accountStatusChangeEmail(
  data: AccountStatusChangeData,
  unsubscribeUrl: string
): string {
  let title: string;
  let mainMessage: string;
  let boxType: "info" | "warning" | "success" = "info";
  let boxContent: string;

  switch (data.status) {
    case "suspended":
      title = "Account Suspended";
      mainMessage = "Your account has been suspended.";
      boxType = "warning";
      boxContent = data.reason
        ? `<strong>Reason:</strong> ${data.reason}`
        : "Your account access has been restricted. Please contact support for more information.";
      break;

    case "reactivated":
      title = "Account Reactivated";
      mainMessage = "Great news! Your account has been reactivated.";
      boxType = "success";
      boxContent = "You now have full access to all features. Welcome back!";
      break;

    case "role_changed":
      title = "Account Role Updated";
      mainMessage = `Your account role has been updated to <strong>${data.newRole}</strong>.`;
      boxType = "info";
      boxContent = data.newRole === "admin"
        ? "You now have administrative access to the platform. Please use these privileges responsibly."
        : "Your permissions have been updated. Contact support if you have any questions.";
      break;

    default:
      title = "Account Update";
      mainMessage = "There has been an update to your account.";
      boxContent = "Please contact support if you have any questions.";
  }

  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
      ${title}
    </h2>

    <p style="margin: 0 0 16px 0;">
      Hi ${data.userName || "there"},
    </p>

    <p style="margin: 0 0 16px 0;">
      ${mainMessage}
    </p>

    ${infoBox(boxContent, boxType)}

    <p style="margin: 24px 0 0 0;">
      If you have any questions or believe this was done in error, please contact us at
      <a href="mailto:${data.contactEmail}" style="color: #2563eb;">${data.contactEmail}</a>.
    </p>
  `;

  return baseLayout(content, {
    title,
    preheader: mainMessage.replace(/<[^>]*>/g, ""),
    unsubscribeUrl,
  });
}

export function accountStatusChangeEmailText(
  data: AccountStatusChangeData
): string {
  let mainMessage: string;
  let additionalInfo: string;

  switch (data.status) {
    case "suspended":
      mainMessage = "Your account has been suspended.";
      additionalInfo = data.reason
        ? `Reason: ${data.reason}`
        : "Your account access has been restricted. Please contact support for more information.";
      break;

    case "reactivated":
      mainMessage = "Great news! Your account has been reactivated.";
      additionalInfo = "You now have full access to all features. Welcome back!";
      break;

    case "role_changed":
      mainMessage = `Your account role has been updated to ${data.newRole}.`;
      additionalInfo = data.newRole === "admin"
        ? "You now have administrative access to the platform. Please use these privileges responsibly."
        : "Your permissions have been updated. Contact support if you have any questions.";
      break;

    default:
      mainMessage = "There has been an update to your account.";
      additionalInfo = "Please contact support if you have any questions.";
  }

  return `
Account Update

Hi ${data.userName || "there"},

${mainMessage}

${additionalInfo}

If you have any questions or believe this was done in error, please contact us at ${data.contactEmail}.

© ${new Date().getFullYear()} CNC Design Library. All rights reserved.
  `.trim();
}
