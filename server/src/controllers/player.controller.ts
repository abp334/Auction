import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import Joi from "joi";
import { Player } from "../models/Player.js";

const createSchema = Joi.object({
  name: Joi.string().min(2).required(),
  role: Joi.string().min(2).required(),
  basePrice: Joi.number().min(0).default(0),
  teamId: Joi.string().optional(),
  photo: Joi.string().optional(),
  mobile: Joi.string().optional(),
  email: Joi.string().email().optional(),
  age: Joi.number().optional(),
  batsmanType: Joi.string().optional(),
  bowlerType: Joi.string().optional(),
  stats: Joi.object().unknown(true).optional(),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  role: Joi.string().min(2).optional(),
  basePrice: Joi.number().min(0).optional(),
  teamId: Joi.string().allow(null).optional(),
  photo: Joi.string().allow(null).optional(),
  mobile: Joi.string().allow(null).optional(),
  email: Joi.string().email().allow(null).optional(),
  age: Joi.number().allow(null).optional(),
  batsmanType: Joi.string().allow(null).optional(),
  bowlerType: Joi.string().allow(null).optional(),
  stats: Joi.object().unknown(true).optional(),
});

export async function listPlayers(req: Request, res: Response) {
  const { teamId } = req.query as { teamId?: string };
  const filter = teamId ? { teamId } : {};
  const players = await Player.find(filter).sort({ name: 1 });
  return res.status(StatusCodes.OK).json({ players });
}

export async function getPlayer(req: Request, res: Response) {
  const { id } = req.params;
  const player = await Player.findById(id);
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
  const player = await Player.create(value);
  return res.status(StatusCodes.CREATED).json({ player });
}

export async function updatePlayer(req: Request, res: Response) {
  const { id } = req.params;
  const { error, value } = updateSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  const player = await Player.findByIdAndUpdate(id, value, { new: true });
  if (!player)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Player not found" });
  return res.status(StatusCodes.OK).json({ player });
}

export async function deletePlayer(req: Request, res: Response) {
  const { id } = req.params;
  const deleted = await Player.findByIdAndDelete(id);
  if (!deleted)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Player not found" });
  return res.status(StatusCodes.NO_CONTENT).send();
}
