import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import crypto from "crypto";
import Joi from "joi";
import prisma from "../utils/db.js";
import { sendEmail, buildInviteEmailHtml, getAppUrl } from "../utils/email.js";

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

const createInviteSchema = Joi.object({
  email: Joi.string().email().optional().allow(null, ""),
  expiresInDays: Joi.number().integer().min(1).max(365).optional(),
  auctionMode: Joi.string().valid("live", "static").default("live"),
});

export async function createInviteCode(
  req: Request & { user?: { id: string; role: string } },
  res: Response
) {
  const { error, value } = createInviteSchema.validate(req.body || {});
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const code = generateCode();
  const expiresAt = value.expiresInDays
    ? new Date(Date.now() + value.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const invite = await prisma.inviteCode.create({
    data: {
      code,
      email: value.email || null,
      expiresAt,
      auctionMode: value.auctionMode,
    },
  });

  // If the code is bound to a specific email, deliver it to that address.
  let emailed = false;
  if (invite.email) {
    const appUrl = getAppUrl();
    const expiryText = expiresAt
      ? ` It expires on ${expiresAt.toDateString()}.`
      : "";
    const modeText =
      invite.auctionMode === "static"
        ? " This code unlocks the static auction ledger (single-admin companion)."
        : " This code unlocks live multiplayer auction control.";
    const text =
      `Welcome to Clash Bid! Your invite code is ${code}.${expiryText}${modeText} ` +
      `Sign up at ${appUrl}/auth using this email address (${invite.email}) to create your organizer account.`;
    emailed = await sendEmail({
      to: invite.email,
      subject: "You're invited to Clash Bid",
      html: buildInviteEmailHtml({ code, appUrl, expiresAt }),
      text,
      code,
    });
  }

  return res.status(StatusCodes.CREATED).json({
    id: invite.id,
    code: invite.code,
    email: invite.email,
    auctionMode: invite.auctionMode,
    expiresAt: invite.expiresAt,
    emailed,
  });
}

export async function listInviteCodes(
  req: Request & { user?: { id: string; role: string } },
  res: Response
) {
  const codes = await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
  });

  return res.status(StatusCodes.OK).json(codes);
}

export async function revokeInviteCode(
  req: Request & { user?: { id: string; role: string } },
  res: Response
) {
  const { id } = req.params;

  const invite = await prisma.inviteCode.findUnique({ where: { id } });
  if (!invite) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Invite code not found" });
  }

  await prisma.inviteCode.delete({ where: { id } });
  return res.status(StatusCodes.NO_CONTENT).send();
}
