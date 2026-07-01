import { logger } from "./logger.js";

/**
 * Sends an email through EmailJS using the same template as the OTP mailer.
 * The shared template exposes `to_email`, `otp` and `message` params, so we
 * map arbitrary content onto those fields. If EmailJS is not configured the
 * message is logged (dev fallback) and we return false so callers know it
 * wasn't actually delivered.
 */
export async function sendEmail(params: {
  to: string;
  message: string;
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
          otp: params.code || "",
          message: params.message,
        },
      };
      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        logger.error({ status: res.status, text }, "EmailJS send failed");
        return false;
      }
      logger.info({ to: params.to }, "Email sent");
      return true;
    } catch (err) {
      logger.error({ err }, "EmailJS network error");
      return false;
    }
  }

  logger.warn(
    { to: params.to, message: params.message },
    "EmailJS not configured — email logged to console"
  );
  return false;
}
