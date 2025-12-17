/**
 * Subscription expiring email template
 */

import { baseLayout, button, infoBox } from "./base-layout";
import type { SubscriptionExpiringData } from "../types";

export function subscriptionExpiringEmail(
  data: SubscriptionExpiringData,
  unsubscribeUrl: string
): string {
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
      Your Subscription is Expiring Soon
    </h2>

    <p style="margin: 0 0 16px 0;">
      Hi ${data.userName || "there"},
    </p>

    <p style="margin: 0 0 16px 0;">
      This is a friendly reminder that your <strong>${data.tierName}</strong> subscription will expire on <strong>${data.expirationDate}</strong>.
    </p>

    ${infoBox(
      `<strong>What happens after expiration:</strong><br>
       You'll lose access to premium features including unlimited downloads and exclusive designs.
       Your favorites and collections will be saved, but some features may be limited.`,
      "warning"
    )}

    <p style="margin: 16px 0;">
      To continue enjoying uninterrupted access to all features, please renew your subscription before the expiration date.
    </p>

    ${button("Renew Subscription", data.renewUrl)}

    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
      If you have any questions about your subscription or need assistance, please contact our support team.
    </p>
  `;

  return baseLayout(content, {
    title: "Subscription Expiring Soon",
    preheader: `Your ${data.tierName} subscription expires on ${data.expirationDate}`,
    unsubscribeUrl,
  });
}

export function subscriptionExpiringEmailText(
  data: SubscriptionExpiringData
): string {
  return `
Your Subscription is Expiring Soon

Hi ${data.userName || "there"},

This is a friendly reminder that your ${data.tierName} subscription will expire on ${data.expirationDate}.

What happens after expiration:
You'll lose access to premium features including unlimited downloads and exclusive designs.
Your favorites and collections will be saved, but some features may be limited.

To continue enjoying uninterrupted access to all features, please renew your subscription before the expiration date.

Renew Subscription: ${data.renewUrl}

If you have any questions about your subscription or need assistance, please contact our support team.

© ${new Date().getFullYear()} CNC Design Library. All rights reserved.
  `.trim();
}
