/**
 * Subscription confirmation email template
 */

import { baseLayout, button, infoBox } from "./base-layout";
import type { SubscriptionConfirmationData } from "../types";

export function subscriptionConfirmationEmail(
  data: SubscriptionConfirmationData,
  unsubscribeUrl: string
): string {
  const amountSection = data.amount
    ? `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Amount</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${data.amount}</td>
      </tr>
    `
    : "";

  const nextBillingSection = data.nextBillingDate
    ? `
      <tr>
        <td style="padding: 8px 0;">Next billing date</td>
        <td style="padding: 8px 0; text-align: right;">${data.nextBillingDate}</td>
      </tr>
    `
    : "";

  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
      Subscription Confirmed!
    </h2>

    <p style="margin: 0 0 16px 0;">
      Hi ${data.userName || "there"},
    </p>

    <p style="margin: 0 0 24px 0;">
      Your subscription to the <strong>${data.tierName}</strong> plan has been confirmed. Thank you for your support!
    </p>

    ${
      data.tierDescription
        ? infoBox(data.tierDescription, "success")
        : ""
    }

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px;">
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Subscription Details</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Plan</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${data.tierName}</td>
            </tr>
            ${amountSection}
            ${nextBillingSection}
          </table>
        </td>
      </tr>
    </table>

    ${button("Manage Subscription", data.manageSubscriptionUrl)}

    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
      You can manage or cancel your subscription at any time from your account settings.
    </p>
  `;

  return baseLayout(content, {
    title: "Subscription Confirmed",
    preheader: `Your ${data.tierName} subscription is now active!`,
    unsubscribeUrl,
  });
}

export function subscriptionConfirmationEmailText(
  data: SubscriptionConfirmationData
): string {
  let details = `Plan: ${data.tierName}`;
  if (data.amount) details += `\nAmount: ${data.amount}`;
  if (data.nextBillingDate) details += `\nNext billing: ${data.nextBillingDate}`;

  return `
Subscription Confirmed!

Hi ${data.userName || "there"},

Your subscription to the ${data.tierName} plan has been confirmed. Thank you for your support!

${data.tierDescription ? `\n${data.tierDescription}\n` : ""}
--- Subscription Details ---
${details}

Manage your subscription: ${data.manageSubscriptionUrl}

You can manage or cancel your subscription at any time from your account settings.

© ${new Date().getFullYear()} CNC Design Library. All rights reserved.
  `.trim();
}
