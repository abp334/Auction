import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import Joi from "joi";
import { User } from "../models/User.js";
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

const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).required(),
  role: Joi.string().valid("admin", "captain", "player").required(),
  teamId: Joi.string().optional(),
});

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

  const existing = await User.findOne({ email: value.email });
  if (existing)
    return res
      .status(StatusCodes.CONFLICT)
      .json({ error: "Email already registered" });

  // Validate team exists for captains
  if (value.role === "captain" && value.teamId) {
    const team = await Team.findById(value.teamId);
    if (!team)
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "Selected team does not exist" });

    // Check if team already has a captain
    const existingCaptain = await User.findOne({
      teamId: value.teamId,
      role: "captain",
    });
    if (existingCaptain)
      return res
        .status(StatusCodes.CONFLICT)
        .json({ error: "Team already has a captain" });
  }

  const passwordHash = await hashPassword(value.password);
  const created = await User.create({
    email: value.email,
    passwordHash,
    name: value.name,
    role: value.role,
    teamId: value.teamId,
  });

  const at = signAccessToken({ sub: created.id, role: created.role });
  const rt = signRefreshToken({ sub: created.id });
  created.refreshTokenHash = await hashRefreshToken(rt);
  await created.save();
  setRefreshCookie(res, rt);
  return res.status(StatusCodes.CREATED).json({
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
