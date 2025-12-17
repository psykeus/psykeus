/**
 * Welcome email template
 */

import { baseLayout, button } from "./base-layout";
import type { WelcomeEmailData } from "../types";

export function welcomeEmail(data: WelcomeEmailData, unsubscribeUrl: string): string {
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
      Welcome to CNC Design Library!
    </h2>

    <p style="margin: 0 0 16px 0;">
      Hi ${data.userName || "there"},
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

    ${button("Start Browsing", data.loginUrl)}

    <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
      If you have any questions, feel free to reach out to our support team.
    </p>
  `;

  return baseLayout(content, {
    title: "Welcome to CNC Design Library",
    preheader: "Your account is ready! Start exploring our design library.",
    unsubscribeUrl,
  });
}

export function welcomeEmailText(data: WelcomeEmailData): string {
  return `
Welcome to CNC Design Library!

Hi ${data.userName || "there"},

Thank you for joining CNC Design Library! We're excited to have you as part of our community.

With your account, you can:
- Browse thousands of CNC and laser cutting designs
- Download files in multiple formats (SVG, DXF, STL, and more)
- Save your favorite designs to collections
- Track your download history

Start Browsing: ${data.loginUrl}

If you have any questions, feel free to reach out to our support team.

© ${new Date().getFullYear()} CNC Design Library. All rights reserved.
  `.trim();
}
