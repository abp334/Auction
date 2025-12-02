import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import Joi from "joi";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import {
  comparePassword,
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  compareRefreshToken,
} from "../utils/auth.js";

// --- VALIDATION SCHEMAS ---

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

// --- HELPER FUNCTIONS ---

async function sendOtpEmail(email: string, otp: string) {
  const message = `Your verification code is ${otp}. It will expire in 10 minutes.`;

  // Prefer EmailJS if configured in .env
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
      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        console.info(`EmailJS send OK for ${email}`);
        return;
      } else {
        console.error(`EmailJS failed: ${await res.text()}`);
      }
    } catch (err) {
      console.error("Failed to send OTP via EmailJS", err);
    }
  }

  // Fallback: Log OTP to console (for localhost development)
  console.info(`[DEV] OTP for ${email}: ${otp}`);
}

function setRefreshCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("rt", token, {
    httpOnly: true,
    secure: isProd ? true : false,
    sameSite: isProd ? "none" : "lax",
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// --- CONTROLLERS ---

export async function signup(req: Request, res: Response) {
  const { error, value } = signupSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  // Check if user exists
  let user = await User.findOne({ email: value.email });
  if (user && user.emailVerified) {
    return res
      .status(StatusCodes.CONFLICT)
      .json({ error: "Email already registered" });
  }

  const passwordHash = await hashPassword(value.password);

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  if (!user) {
    // Create new unverified user
    user = await User.create({
      email: value.email,
      passwordHash,
      name: value.name,
      role: value.role || "player",
      emailVerified: false,
      otpHash,
      otpExpires,
    });
  } else {
    // Overwrite unverified user with new details
    user.passwordHash = passwordHash;
    user.name = value.name;
    user.role = value.role || "player";
    user.otpHash = otpHash;
    user.otpExpires = otpExpires;
    await user.save();
  }

  // Send the OTP
  await sendOtpEmail(user.email, otp);

  // IMPORTANT: Do NOT send tokens yet. User must verify OTP first.
  return res.status(StatusCodes.OK).json({
    message: "OTP sent to your email. Please verify to complete signup.",
  });
}

export async function verifyOtp(req: Request, res: Response) {
  const { error, value } = verifyOtpSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const user = await User.findOne({ email: value.email });
  if (!user)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });

  if (user.emailVerified) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "User already verified" });
  }

  // Check Expiry
  if (!user.otpHash || !user.otpExpires || user.otpExpires < new Date()) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "OTP expired or invalid" });
  }

  // Check OTP Match
  const validOtp = await bcrypt.compare(value.otp, user.otpHash);
  if (!validOtp)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid OTP" });

  // Success: Mark verified & Clean up
  user.emailVerified = true;
  user.otpHash = undefined;
  user.otpExpires = undefined;

  // Issue Tokens (Login the user)
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

export async function login(req: Request, res: Response) {
  const { error, value } = loginSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const user = await User.findOne({ email: value.email });
  if (!user)
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Invalid credentials" });

  // Block login if not verified
  if (!user.emailVerified) {
    return res.status(StatusCodes.FORBIDDEN).json({
      error:
        "Email not verified. Please check your email for the OTP or signup again to resend it.",
    });
  }

  const ok = await comparePassword(value.password, user.passwordHash);
  if (!ok)
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Invalid credentials" });

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

export async function debugUser(req: Request, res: Response) {
  if (process.env.NODE_ENV === "production") {
    return res
      .status(StatusCodes.FORBIDDEN)
      .json({ error: "Not allowed in production" });
  }
  const email = (req.query as any)?.email;
  if (!email)
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "email query required" });
  const user = await User.findOne({ email }).lean();
  if (!user)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });
  return res.status(StatusCodes.OK).json({
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
    passwordHash: user.passwordHash,
    otpHash: user.otpHash,
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
