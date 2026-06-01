import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import Joi from "joi";
import prisma from "../utils/db.js";

const createSchema = Joi.object({
  name: Joi.string().min(2).required(),
  role: Joi.string().min(2).required(),
  basePrice: Joi.number().integer().min(0).default(0),
  teamId: Joi.string().uuid().optional().allow(null),
  photo: Joi.string().optional().allow(null, ""),
  mobile: Joi.string().optional().allow(null, ""),
  email: Joi.string().email().optional().allow(null, ""),
  age: Joi.number().integer().optional().allow(null),
  batsmanType: Joi.string().optional().allow(null, ""),
  bowlerType: Joi.string().optional().allow(null, ""),
  stats: Joi.object().unknown(true).optional(),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  role: Joi.string().min(2).optional(),
  basePrice: Joi.number().integer().min(0).optional(),
  teamId: Joi.string().uuid().allow(null).optional(),
  photo: Joi.string().allow(null, "").optional(),
  mobile: Joi.string().allow(null, "").optional(),
  email: Joi.string().email().allow(null, "").optional(),
  age: Joi.number().integer().allow(null).optional(),
  batsmanType: Joi.string().allow(null, "").optional(),
  bowlerType: Joi.string().allow(null, "").optional(),
  stats: Joi.object().unknown(true).optional(),
});

export async function listPlayers(req: Request, res: Response) {
  const { teamId } = req.query as { teamId?: string };
  const where = teamId ? { teamId } : {};
  const players = await prisma.player.findMany({
    where,
    orderBy: { name: "asc" },
  });
  return res.status(StatusCodes.OK).json({ players });
}

export async function getPlayer(req: Request, res: Response) {
  const { id } = req.params;
  const player = await prisma.player.findUnique({ where: { id } });
  if (!player)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Player not found" });
  return res.status(StatusCodes.OK).json({ player });
}

export async function createPlayer(req: Request, res: Response) {
  const { error, value } = createSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const player = await prisma.player.create({ data: value });
  return res.status(StatusCodes.CREATED).json({ player });
}

export async function updatePlayer(req: Request, res: Response) {
  const { id } = req.params;
  const { error, value } = updateSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  try {
    const player = await prisma.player.update({ where: { id }, data: value });
    return res.status(StatusCodes.OK).json({ player });
  } catch {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Player not found" });
  }
}

export async function deletePlayer(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await prisma.player.delete({ where: { id } });
    return res.status(StatusCodes.NO_CONTENT).send();
  } catch {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Player not found" });
  }
}
