import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import prisma from "../utils/db.js";
import { isSuperAdminUser } from "../utils/superAdmin.js";
import { isTestParticipantEmail } from "../utils/testAuctionSeed.js";

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

export async function listAdminUsers(req: Request, res: Response) {
  const users = await prisma.user.findMany({
    where: { role: "admin" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return res.status(StatusCodes.OK).json({ users });
}

export async function listCaptainUsers(
  req: Request & { user?: { id: string; role: string } },
  res: Response
) {
  const superAdmin =
    req.user?.id ? await isSuperAdminUser(req.user.id) : false;

  const users = await prisma.user.findMany({
    where: { role: "captain" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      team: { select: { id: true, name: true } },
      auction: { select: { id: true, name: true, roomCode: true, state: true, isTest: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const visible = superAdmin
    ? users
    : users.filter((u) => !isTestParticipantEmail(u.email));

  return res.status(StatusCodes.OK).json({ users: visible });
}

export async function deleteUser(
  req: Request & { user?: { id: string; role: string } },
  res: Response
) {
  const { id } = req.params;

  if (req.user?.id === id) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "You cannot delete your own account." });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });
  }

  // If the user owns any auctions, delete those first
  const ownedAuctions = await prisma.auction.findMany({
    where: { createdById: id },
    select: { id: true },
  });

  if (ownedAuctions.length > 0) {
    const auctionIds = ownedAuctions.map((a) => a.id);
    await prisma.$transaction(async (tx) => {
      for (const aId of auctionIds) {
        await tx.auction.update({
          where: { id: aId },
          data: {
            currentPlayerId: null,
            currentBidAmount: null,
            currentBidTeamId: null,
          },
        });
      }
      await tx.user.deleteMany({
        where: { auctionId: { in: auctionIds } },
      });
      await tx.auction.deleteMany({ where: { id: { in: auctionIds } } });
    });
  } else if (target.role === "captain") {
    await prisma.team.updateMany({
      where: { captainId: id },
      data: { captainId: null },
    });
  }

  await prisma.user.delete({ where: { id } });

  return res.status(StatusCodes.OK).json({ message: "User deleted" });
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
