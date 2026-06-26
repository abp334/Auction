import prisma from "./db.js";
import { stopAuctionTimer } from "./timer.js";
import { TEST_AUCTION_DOMAIN } from "./testAuctionSeed.js";
import { logger } from "./logger.js";

const TEST_EMAIL_SUFFIX = `@${TEST_AUCTION_DOMAIN}`;

/** Remove all sandbox auctions and their teams/players; keep reusable @test.clashbid logins. */
export async function wipeAllTestAuctions(): Promise<number> {
  const testAuctions = await prisma.auction.findMany({
    where: {
      OR: [{ isTest: true }, { name: "ClashBid Test Auction" }],
    },
    include: {
      teams: { select: { teamId: true } },
      players: { select: { playerId: true } },
    },
  });

  for (const auction of testAuctions) {
    await wipeTestAuctionById(auction.id, {
      teamIds: auction.teams.map((t) => t.teamId),
      playerIds: auction.players.map((p) => p.playerId),
    });
  }

  return testAuctions.length;
}

async function wipeTestAuctionById(
  auctionId: string,
  ids: { teamIds: string[]; playerIds: string[] }
) {
  stopAuctionTimer(auctionId);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.auction.update({
        where: { id: auctionId },
        data: {
          currentPlayerId: null,
          currentBidAmount: null,
          currentBidTeamId: null,
          currentBidAt: null,
        },
      });

      // Reuse test logins on the next seed — do not delete @test.clashbid accounts.
      await tx.user.updateMany({
        where: {
          auctionId,
          email: { endsWith: TEST_EMAIL_SUFFIX },
        },
        data: { auctionId: null, teamId: null },
      });

      if (ids.playerIds.length > 0) {
        await tx.player.deleteMany({ where: { id: { in: ids.playerIds } } });
      }
      if (ids.teamIds.length > 0) {
        await tx.team.deleteMany({ where: { id: { in: ids.teamIds } } });
      }

      await tx.auction.delete({ where: { id: auctionId } });
    });
  } catch (err) {
    logger.error({ err, auctionId }, "Failed to wipe test auction");
    throw err;
  }
}
