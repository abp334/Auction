import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import Joi from "joi";
import { Team } from "../models/Team.js";

const createSchema = Joi.object({
  name: Joi.string().min(2).required(),
  wallet: Joi.number().min(0).default(0),
  captainId: Joi.string().optional(),
  logo: Joi.string().optional(),
  owner: Joi.string().optional(),
  mobile: Joi.string().optional(),
  email: Joi.string().email().optional(),
  captain: Joi.string().optional(),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  wallet: Joi.number().min(0).optional(),
  captainId: Joi.string().allow(null).optional(),
  logo: Joi.string().allow(null).optional(),
  owner: Joi.string().allow(null).optional(),
  mobile: Joi.string().allow(null).optional(),
  email: Joi.string().email().allow(null).optional(),
  captain: Joi.string().allow(null).optional(),
});

export async function listTeams(_req: Request, res: Response) {
  const teams = await Team.find().sort({ name: 1 });
  return res.status(StatusCodes.OK).json({ teams });
}

export async function getTeam(req: Request, res: Response) {
  const { id } = req.params;
  const team = await Team.findById(id);
  if (!team)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "Team not found" });
  return res.status(StatusCodes.OK).json({ team });
}

export async function createTeam(req: Request, res: Response) {
  const { error, value } = createSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const exists = await Team.findOne({ name: value.name });
  if (exists)
    return res
      .status(StatusCodes.CONFLICT)
      .json({ error: "Team name already exists" });

  const team = await Team.create(value);
  return res.status(StatusCodes.CREATED).json({ team });
}

export async function updateTeam(req: Request, res: Response) {
  const { id } = req.params;
  const { error, value } = updateSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const team = await Team.findByIdAndUpdate(id, value, { new: true });
  if (!team)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "Team not found" });
  return res.status(StatusCodes.OK).json({ team });
}

export async function deleteTeam(req: Request, res: Response) {
  const { id } = req.params;
  const deleted = await Team.findByIdAndDelete(id);
  if (!deleted)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "Team not found" });
  return res.status(StatusCodes.NO_CONTENT).send();
}
