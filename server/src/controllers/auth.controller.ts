import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import Joi from "joi";
import bcrypt from "bcryptjs";
import prisma from "../utils/db.js";
import {
  comparePassword,
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  compareRefreshToken,
} from "../utils/auth.js";
import { logger } from "../utils/logger.js";

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

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

async function sendOtpEmail(email: string, otp: string): Promise<boolean> {
  const message = `Your verification code is ${otp}. It will expire in 10 minutes.`;
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
        template_params: { to_email: email, otp, message },
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
      logger.info({ email }, "OTP email sent");
      return true;
    } catch (err) {
      logger.error({ err }, "EmailJS network error");
      return false;
    }
  }

  logger.warn({ email, otp }, "EmailJS not configured — OTP logged to console");
  return true;
}

function setRefreshCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("rt", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function signup(req: Request, res: Response) {
  const { error, value } = signupSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const existing = await prisma.user.findUnique({
    where: { email: value.email },
  });
  if (existing && existing.emailVerified) {
    return res
      .status(StatusCodes.CONFLICT)
      .json({ error: "Email already registered" });
  }

  const passwordHash = await hashPassword(value.password);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  if (!existing) {
    await prisma.user.create({
      data: {
        email: value.email,
        passwordHash,
        name: value.name,
        role: value.role || "player",
        emailVerified: false,
        otpHash,
        otpExpires,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        name: value.name,
        role: value.role || "player",
        otpHash,
        otpExpires,
      },
    });
  }

  await sendOtpEmail(value.email, otp);

  return res.status(StatusCodes.OK).json({
    message: "OTP sent to your email. Please verify to complete signup.",
  });
}

export async function verifyOtp(req: Request, res: Response) {
  const { error, value } = verifyOtpSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const user = await prisma.user.findUnique({
    where: { email: value.email },
  });
  if (!user)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });
  if (user.emailVerified)
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "User already verified" });
  if (!user.otpHash || !user.otpExpires || user.otpExpires < new Date())
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "OTP expired or invalid" });

  const validOtp = await bcrypt.compare(value.otp, user.otpHash);
  if (!validOtp)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid OTP" });

  const at = signAccessToken({ sub: user.id, role: user.role });
  const rt = signRefreshToken({ sub: user.id });
  const rtHash = await hashRefreshToken(rt);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      otpHash: null,
      otpExpires: null,
      refreshTokenHash: rtHash,
    },
  });

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

export async function login(req: Request, res: Response) {
  const { error, value } = loginSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const user = await prisma.user.findUnique({
    where: { email: value.email },
  });
  if (!user)
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Invalid credentials" });
  if (!user.emailVerified)
    return res.status(StatusCodes.FORBIDDEN).json({
      error:
        "Email not verified. Please check your email for the OTP or signup again to resend it.",
    });

  const ok = await comparePassword(value.password, user.passwordHash);
  if (!ok)
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Invalid credentials" });

  const at = signAccessToken({ sub: user.id, role: user.role });
  const rt = signRefreshToken({ sub: user.id });
  const rtHash = await hashRefreshToken(rt);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: rtHash },
  });

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

export async function me(
  req: Request & { user?: { id: string; role: string } },
  res: Response
) {
  if (!req.user)
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
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

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user)
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Invalid session" });

  const ok = await compareRefreshToken(rt, user.refreshTokenHash);
  if (!ok)
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Invalid session" });

  const newRt = signRefreshToken({ sub: user.id });
  const rtHash = await hashRefreshToken(newRt);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: rtHash },
  });

  setRefreshCookie(res, newRt);

  const at = signAccessToken({ sub: user.id, role: user.role });
  return res.status(StatusCodes.OK).json({ accessToken: at });
}

export async function logout(req: Request, res: Response) {
  const rt = req.cookies?.rt as string | undefined;
  if (rt) {
    try {
      const payload = verifyRefreshToken(rt);
      await prisma.user.update({
        where: { id: payload.sub },
        data: { refreshTokenHash: null },
      });
    } catch {
      // token invalid, ignore
    }
  }
  res.clearCookie("rt", { path: "/api/v1/auth" });
  return res.status(StatusCodes.NO_CONTENT).send();
}
