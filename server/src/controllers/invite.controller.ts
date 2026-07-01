import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import crypto from "crypto";
import prisma from "../utils/db.js";
import { sendEmail } from "../utils/email.js";

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export async function createInviteCode(
  req: Request & { user?: { id: string; role: string } },
  res: Response
) {
  const { email, expiresInDays } = req.body;

  const code = generateCode();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const invite = await prisma.inviteCode.create({
    data: {
      code,
      email: email || null,
      expiresAt,
    },
  });

  // If the code is bound to a specific email, deliver it to that address.
  let emailed = false;
  if (invite.email) {
    const appUrl =
      process.env.APP_URL || process.env.FRONTEND_URL || "https://clashbid.live";
    const expiryLine = expiresAt
      ? ` It expires on ${expiresAt.toDateString()}.`
      : "";
    const message =
      `You've been invited to ClashBid. Your invite code is ${code}.${expiryLine} ` +
      `Sign up at ${appUrl}/auth using this email address (${invite.email}) to create your organizer account.`;
    emailed = await sendEmail({
      to: invite.email,
      code,
      message,
    });
  }

  return res.status(StatusCodes.CREATED).json({
    id: invite.id,
    code: invite.code,
    email: invite.email,
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

  return res.status(StatusCodes.OK).json({ message: "Invite code revoked" });
}
