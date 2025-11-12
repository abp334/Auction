import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import Joi from "joi";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { PendingUser } from "../models/PendingUser.js";
import { Team } from "../models/Team.js";
import {
  comparePassword,
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  compareRefreshToken,
} from "../utils/auth.js";

// Signup allows 'admin' or 'player' roles from UI; captains must be promoted by admin.
const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).required(),
  role: Joi.string().valid("admin", "player").default("player"),
});

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required(),
});

async function sendOtpEmail(email: string, otp: string) {
  const message = `Your verification code is ${otp}. It will expire in 10 minutes.`;

  // Prefer EmailJS if configured
  const emailJsService = process.env.EMAILJS_SERVICE_ID;
  const emailJsTemplate = process.env.EMAILJS_TEMPLATE_ID;
  const emailJsUser =
    process.env.EMAILJS_USER_ID || process.env.EMAILJS_PUBLIC_KEY;

  if (emailJsService && emailJsTemplate && emailJsUser) {
    try {
      const body = {
        service_id: emailJsService,
        template_id: emailJsTemplate,
        user_id: emailJsUser,
        template_params: {
          to_email: email,
          otp,
          message,
        },
      };
      await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return;
    } catch (err) {
      console.error("Failed to send OTP via EmailJS", err);
      // fall through to logging
    }
  }

  // Fallback: log OTP to server logs for development / manual delivery.
  console.info(`OTP for ${email}: ${otp}`);
}

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

function setRefreshCookie(res: Response, token: string) {
  // Cross-origin between different localhost ports needs SameSite=None + Secure
  // Modern browsers treat localhost as secure context; use Secure always.
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("rt", token, {
    httpOnly: true,
    secure: isProd ? true : false,
    sameSite: isProd ? "none" : "lax",
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function signup(req: Request, res: Response) {
  const { error, value } = signupSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  // Check existing active users
  const existing = await User.findOne({ email: value.email });
  if (existing)
    return res
      .status(StatusCodes.CONFLICT)
      .json({ error: "Email already registered" });

  // Check if there's already a pending signup for this email
  const pendingExisting = await PendingUser.findOne({ email: value.email });
  if (pendingExisting)
    return res
      .status(StatusCodes.CONFLICT)
      .json({ error: "Signup already in progress for this email" });

  const passwordHash = await hashPassword(value.password);

  // Generate OTP and persist hashed OTP on the user record.
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Create a pending signup record (user only created after OTP verification)
  const pending = await PendingUser.create({
    email: value.email,
    passwordHash,
    name: value.name,
    role: value.role || "player",
    otpHash,
    otpExpires,
  });

  // Send OTP (logs if SMTP not configured)
  sendOtpEmail(value.email, otp).catch(console.error);

  return res.status(StatusCodes.OK).json({
    message: "OTP sent to email. Verify to complete signup.",
    email: pending.email,
  });
}

export async function login(req: Request, res: Response) {
  const { error, value } = loginSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const user = await User.findOne({ email: value.email });
  if (!user)
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Invalid credentials" });

  const ok = await comparePassword(value.password, user.passwordHash);
  if (!ok)
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Invalid credentials" });
  // Require email verification
  if (!user.emailVerified) {
    return res
      .status(StatusCodes.FORBIDDEN)
      .json({ error: "Email not verified. Please verify your email first." });
  }

  const at = signAccessToken({ sub: user.id, role: user.role });
  const rt = signRefreshToken({ sub: user.id });
  user.refreshTokenHash = await hashRefreshToken(rt);
  await user.save();
  setRefreshCookie(res, rt);
  return res.status(StatusCodes.OK).json({
    accessToken: at,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
    },
  });
}

export async function verifySignupOtp(req: Request, res: Response) {
  const { error, value } = verifyOtpSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  // Look for pending signup first
  const pending = await PendingUser.findOne({ email: value.email });
  if (!pending)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Signup not found or already verified" });

  if (
    !pending.otpHash ||
    !pending.otpExpires ||
    pending.otpExpires < new Date()
  )
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "OTP expired or not found" });

  const ok = await bcrypt.compare(value.otp, pending.otpHash);
  if (!ok)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid OTP" });

  // Create final user account
  const created = await User.create({
    email: pending.email,
    passwordHash: pending.passwordHash,
    name: pending.name,
    role: pending.role || "player",
    emailVerified: true,
  });

  // Remove pending record
  await PendingUser.deleteOne({ _id: pending._id });

  // Issue tokens and login user
  const at = signAccessToken({ sub: created.id, role: created.role });
  const rt = signRefreshToken({ sub: created.id });
  created.refreshTokenHash = await hashRefreshToken(rt);
  await created.save();
  setRefreshCookie(res, rt);

  return res.status(StatusCodes.OK).json({
    accessToken: at,
    user: {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      teamId: created.teamId,
    },
  });
}

export async function me(
  req: Request & { user?: { id: string; role: string } },
  res: Response
) {
  if (!req.user)
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Unauthorized" });
  const user = await User.findById(req.user.id);
  if (!user)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });
  return res.status(StatusCodes.OK).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
    },
  });
}

export async function refresh(req: Request, res: Response) {
  const rt = req.cookies?.rt as string | undefined;
  if (!rt)
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Missing refresh token" });
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(rt);
  } catch {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Invalid refresh token" });
  }
  const user = await User.findById(payload.sub);
  if (!user)
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Invalid session" });
  const ok = await compareRefreshToken(rt, user.refreshTokenHash);
  if (!ok)
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Invalid session" });

  // rotate refresh token
  const newRt = signRefreshToken({ sub: user.id });
  user.refreshTokenHash = await hashRefreshToken(newRt);
  await user.save();
  setRefreshCookie(res, newRt);

  const at = signAccessToken({ sub: user.id, role: user.role });
  return res.status(StatusCodes.OK).json({ accessToken: at });
}

export async function logout(req: Request, res: Response) {
  const rt = req.cookies?.rt as string | undefined;
  if (rt) {
    try {
      const payload = verifyRefreshToken(rt);
      const user = await User.findById(payload.sub);
      if (user) {
        user.refreshTokenHash = undefined;
        await user.save();
      }
    } catch {}
  }
  res.clearCookie("rt", { path: "/api/v1/auth" });
  return res.status(StatusCodes.NO_CONTENT).send();
}
