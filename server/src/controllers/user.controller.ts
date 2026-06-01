import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import prisma from "../utils/db.js";

export async function listUsers(req: Request, res: Response) {
  const { search } = req.query as { search?: string };

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, teamId: true },
    orderBy: { name: "asc" },
  });

  return res.status(StatusCodes.OK).json({ users });
}

export async function promoteUser(req: Request, res: Response) {
  const { id } = req.params;
  const { teamId } = req.body as { teamId?: string };

  if (!teamId)
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "teamId is required to promote to captain" });

  const [user, team] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.team.findUnique({ where: { id: teamId } }),
  ]);

  if (!user)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });
  if (!team)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "Team not found" });

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { role: "captain", teamId },
    }),
    prisma.team.update({
      where: { id: teamId },
      data: { captainId: id, captain: user.name },
    }),
  ]);

  return res.status(StatusCodes.OK).json({
    user: { id: user.id, name: user.name, role: "captain" },
    team: { id: team.id, name: team.name },
  });
}
