import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Joi from "joi";
import { logger } from "../utils/logger.js";

const CONTACT_TO =
  process.env.CONTACT_TO_EMAIL || "subscription.clashbid@gmail.com";

const contactSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string().trim().email().max(255).required(),
  subject: Joi.string().trim().min(1).max(200).required(),
  message: Joi.string().trim().min(10).max(2000).required(),
});

async function sendContactEmail(params: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<boolean> {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId =
    process.env.EMAILJS_CONTACT_TEMPLATE_ID ||
    process.env.EMAILJS_TEMPLATE_ID;
  const publicKey =
    process.env.EMAILJS_USER_ID || process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey) {
    logger.warn("Contact email skipped — EmailJS not configured");
    return false;
  }

  const bodyText = [
    `New message from the ClashBid contact form`,
    ``,
    `Name: ${params.name}`,
    `Email: ${params.email}`,
    `Subject: ${params.subject}`,
    ``,
    params.message,
  ].join("\n");

  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email: CONTACT_TO,
          user_name: params.name,
          user_email: params.email,
          from_name: params.name,
          from_email: params.email,
          reply_to: params.email,
          subject: `[ClashBid Contact] ${params.subject}`,
          message: bodyText,
          otp: params.subject,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, text }, "Contact EmailJS send failed");
      return false;
    }

    logger.info({ from: params.email, subject: params.subject }, "Contact email sent");
    return true;
  } catch (err) {
    logger.error({ err }, "Contact EmailJS network error");
    return false;
  }
}

export async function submitContact(req: Request, res: Response) {
  const { error, value } = contactSchema.validate(req.body);
  if (error) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }

  const sent = await sendContactEmail(value);
  if (!sent) {
    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      error:
        "Email delivery is not configured yet. Please use the email link on this page.",
      mailto: `mailto:${CONTACT_TO}?subject=${encodeURIComponent(value.subject)}&body=${encodeURIComponent(
        `From: ${value.name} (${value.email})\n\n${value.message}`
      )}`,
    });
  }

  return res.status(StatusCodes.OK).json({
    message: "Thanks — we received your message and will reply soon.",
  });
}
