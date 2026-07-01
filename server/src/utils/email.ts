import { logger } from "./logger.js";

/**
 * Clash Bid email helpers.
 *
 * The actual delivery goes through EmailJS. We generate fully branded HTML in
 * code (so the look is version-controlled here) and hand it to EmailJS via the
 * `html` template variable. See EMAIL_SETUP notes at the bottom of this file
 * for the one-time EmailJS template change required to render it.
 *
 * We also pass plain-text `message`, `subject`, `title` and `otp` params so the
 * mail still works with the legacy OTP template while the new template is set
 * up.
 */

const BRAND = "Clash Bid";
const AMBER = "#f59e0b";
const BG_DARK = "#0f1419";
const BG_CARD = "#1a2332";

export function getAppUrl(): string {
  return (
    process.env.APP_URL || process.env.FRONTEND_URL || "https://clashbid.live"
  );
}

function getLogoUrl(): string {
  return `${getAppUrl().replace(/\/$/, "")}/logo.png`;
}

/** Shared responsive dark-theme shell used by all Clash Bid emails. */
function wrapEmail(opts: {
  preheader: string;
  bodyHtml: string;
}): string {
  const logoUrl = getLogoUrl();
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark light" />
  </head>
  <body style="margin:0;padding:0;background:${BG_DARK};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${opts.preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_DARK};padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${BG_CARD};border:1px solid rgba(245,158,11,0.25);border-radius:16px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:32px 32px 8px 32px;">
                <img src="${logoUrl}" alt="${BRAND}" width="64" height="64" style="display:block;border:0;outline:none;border-radius:14px;background:rgba(245,158,11,0.1);" />
                <div style="margin-top:14px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                  Clash<span style="color:${AMBER};">Bid</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px 32px;">
                ${opts.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:rgba(255,255,255,0.03);border-top:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0;font-size:12px;line-height:18px;color:#7c8798;text-align:center;">
                  ${BRAND} — the live sports auction platform.<br />
                  You received this email because your address was used on ${BRAND}. If this wasn't you, you can safely ignore it.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** OTP / verification-code email (login + signup verification). */
export function buildOtpEmailHtml(opts: {
  otp: string;
  purpose?: "signup" | "password" | "login";
}): string {
  const heading =
    opts.purpose === "password"
      ? "Reset your password"
      : "Verify your email";
  const intro =
    opts.purpose === "password"
      ? "Use the one-time code below to securely set your new password."
      : "Welcome! Use the one-time code below to verify your email and continue.";

  const body = `
    <h1 style="margin:16px 0 8px 0;font-size:20px;color:#ffffff;text-align:center;">${heading}</h1>
    <p style="margin:0 0 24px 0;font-size:14px;line-height:22px;color:#aeb7c4;text-align:center;">${intro}</p>
    <div style="margin:0 auto 20px auto;max-width:280px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.35);border-radius:12px;padding:20px;text-align:center;">
      <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${AMBER};margin-bottom:8px;">Your verification code</div>
      <div style="font-size:38px;font-weight:800;letter-spacing:10px;color:#ffffff;font-family:'Courier New',monospace;">${opts.otp}</div>
    </div>
    <p style="margin:0 0 6px 0;font-size:13px;line-height:20px;color:#aeb7c4;text-align:center;">This code expires in <strong style="color:#ffffff;">10 minutes</strong>.</p>
    <p style="margin:0;font-size:12px;line-height:18px;color:#7c8798;text-align:center;">Never share this code. ${BRAND} will never ask you for it.</p>
  `;

  return wrapEmail({
    preheader: `Your ${BRAND} verification code is ${opts.otp}`,
    bodyHtml: body,
  });
}

/** Welcome / invite-code email sent when a super-admin issues a code to an email. */
export function buildInviteEmailHtml(opts: {
  code: string;
  appUrl: string;
  expiresAt?: Date | null;
}): string {
  const signupUrl = `${opts.appUrl.replace(/\/$/, "")}/auth`;
  const expiryLine = opts.expiresAt
    ? `<p style="margin:16px 0 0 0;font-size:12px;line-height:18px;color:#7c8798;text-align:center;">This invite expires on <strong style="color:#aeb7c4;">${opts.expiresAt.toDateString()}</strong>.</p>`
    : "";

  const body = `
    <h1 style="margin:16px 0 8px 0;font-size:22px;color:#ffffff;text-align:center;">Welcome to ${BRAND}! 🎉</h1>
    <p style="margin:0 0 20px 0;font-size:14px;line-height:22px;color:#aeb7c4;text-align:center;">
      Thanks for subscribing. You're all set to run your own live sports auctions —
      build teams, invite captains, and let the bidding begin.
    </p>
    <div style="margin:0 auto 22px auto;max-width:320px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.35);border-radius:12px;padding:20px;text-align:center;">
      <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${AMBER};margin-bottom:8px;">Your invite code</div>
      <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#ffffff;font-family:'Courier New',monospace;">${opts.code}</div>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:4px 0 8px 0;">
          <a href="${signupUrl}" style="display:inline-block;background:${AMBER};color:#0f1419;font-weight:700;font-size:15px;text-decoration:none;padding:13px 28px;border-radius:10px;">
            Create your account
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0 0;font-size:13px;line-height:20px;color:#aeb7c4;text-align:center;">
      Sign up at <a href="${signupUrl}" style="color:${AMBER};text-decoration:none;">${signupUrl}</a> using
      <strong style="color:#ffffff;">this email address</strong> and enter the code above.
    </p>
    ${expiryLine}
  `;

  return wrapEmail({
    preheader: `Your ${BRAND} invite code is ${opts.code}`,
    bodyHtml: body,
  });
}

/**
 * Sends an email through EmailJS.
 *
 * `html` is the fully branded body generated above. We also send `subject`,
 * `title`, `message` (plain-text fallback) and `otp` so both the new
 * pass-through template and the legacy template keep working.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  code?: string;
}): Promise<boolean> {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey =
    process.env.EMAILJS_USER_ID || process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (serviceId && templateId && publicKey) {
    try {
      const body = {
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email: params.to,
          subject: params.subject,
          title: params.subject,
          // Full branded HTML (render with {{{html}}} in the EmailJS template).
          html: params.html,
          content: params.html,
          // Plain-text fallback / legacy template variable.
          message: params.text,
          otp: params.code || "",
        },
      };
      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text();
        logger.error({ status: res.status, errText }, "EmailJS send failed");
        return false;
      }
      logger.info({ to: params.to, subject: params.subject }, "Email sent");
      return true;
    } catch (err) {
      logger.error({ err }, "EmailJS network error");
      return false;
    }
  }

  logger.warn(
    { to: params.to, subject: params.subject },
    "EmailJS not configured — email logged to console"
  );
  return false;
}
