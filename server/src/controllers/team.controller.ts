import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import Joi from "joi";
import prisma from "../utils/db.js";
import { isSuperAdminUser } from "../utils/superAdmin.js";

const createSchema = Joi.object({
  name: Joi.string().min(2).required(),
  wallet: Joi.number().integer().min(0).default(0),
  captainId: Joi.string().uuid().optional(),
  logo: Joi.string().optional().allow(null, ""),
  owner: Joi.string().optional().allow(null, ""),
  mobile: Joi.string().optional().allow(null, ""),
  email: Joi.string().email().optional().allow(null, ""),
  captain: Joi.string().optional().allow(null, ""),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  wallet: Joi.number().integer().min(0).optional(),
  captainId: Joi.string().uuid().allow(null).optional(),
  logo: Joi.string().allow(null, "").optional(),
  owner: Joi.string().allow(null, "").optional(),
  mobile: Joi.string().allow(null, "").optional(),
  email: Joi.string().email().allow(null, "").optional(),
  captain: Joi.string().allow(null, "").optional(),
});

async function getTestOnlyTeamIds(): Promise<Set<string>> {
  const links = await prisma.auctionTeam.findMany({
    select: {
      teamId: true,
      auction: { select: { isTest: true } },
    },
  });

  const counts = new Map<string, { test: number; prod: number }>();
  for (const link of links) {
    const cur = counts.get(link.teamId) || { test: 0, prod: 0 };
    if (link.auction.isTest) cur.test++;
    else cur.prod++;
    counts.set(link.teamId, cur);
  }

  const testOnly = new Set<string>();
  for (const [teamId, c] of counts) {
    if (c.test > 0 && c.prod === 0) testOnly.add(teamId);
  }
  return testOnly;
}

export async function listTeams(
  req: Request & { user?: { id: string; role: string } },
  res: Response
) {
  const superAdmin =
    req.user?.id ? await isSuperAdminUser(req.user.id) : false;

  let teams = await prisma.team.findMany({ orderBy: { name: "asc" } });

  if (!superAdmin) {
    const testOnlyIds = await getTestOnlyTeamIds();
    teams = teams.filter((t) => !testOnlyIds.has(t.id));
  }

  return res.status(StatusCodes.OK).json({ teams });
}

export async function getTeam(
  req: Request & { user?: { id: string; role: string } },
  res: Response
) {
  const { id } = req.params;
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "Team not found" });

  const superAdmin =
    req.user?.id ? await isSuperAdminUser(req.user.id) : false;
  if (!superAdmin) {
    const testOnlyIds = await getTestOnlyTeamIds();
    if (testOnlyIds.has(id)) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Team not found" });
    }
  }

  return res.status(StatusCodes.OK).json({ team });
}

export async function createTeam(req: Request, res: Response) {
  const { error, value } = createSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const exists = await prisma.team.findFirst({ where: { name: value.name } });
  if (exists)
    return res
      .status(StatusCodes.CONFLICT)
      .json({ error: "Team name already exists" });

  const team = await prisma.$transaction(async (tx) => {
    const created = await tx.team.create({ data: value });

    if (value.captainId) {
      const user = await tx.user.findUnique({
        where: { id: value.captainId },
      });
      if (user) {
        await tx.user.update({
          where: { id: user.id },
          data: { role: "captain", teamId: created.id },
        });
        return tx.team.update({
          where: { id: created.id },
          data: { captainId: user.id, captain: user.name },
        });
      }
    }
    return created;
  });

  return res.status(StatusCodes.CREATED).json({ team });
}

export async function updateTeam(req: Request, res: Response) {
  const { id } = req.params;
  const { error, value } = updateSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const existing = await prisma.team.findUnique({ where: { id } });
  if (!existing)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "Team not found" });

  const team = await prisma.$transaction(async (tx) => {
    let updated = await tx.team.update({ where: { id }, data: value });

    if (value.captainId) {
      const user = await tx.user.findUnique({
        where: { id: value.captainId },
      });
      if (user) {
        await tx.user.update({
          where: { id: user.id },
          data: { role: "captain", teamId: id },
        });
        updated = await tx.team.update({
          where: { id },
          data: { captainId: user.id, captain: user.name },
        });
      }
    }
    return updated;
  });

  return res.status(StatusCodes.OK).json({ team });
}

export async function deleteTeam(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await prisma.team.delete({ where: { id } });
    return res.status(StatusCodes.NO_CONTENT).send();
  } catch {
    return res.status(StatusCodes.NOT_FOUND).json({ error: "Team not found" });
  }
}
