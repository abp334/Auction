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

  if (!testAuctions.length) return 0;

  const auctionIds = testAuctions.map((a) => a.id);
  const teamIds = [
    ...new Set(testAuctions.flatMap((a) => a.teams.map((t) => t.teamId))),
  ];
  const playerIds = [
    ...new Set(testAuctions.flatMap((a) => a.players.map((p) => p.playerId))),
  ];

  for (const id of auctionIds) stopAuctionTimer(id);

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.auction.updateMany({
          where: { id: { in: auctionIds } },
          data: {
            currentPlayerId: null,
            currentBidAmount: null,
            currentBidTeamId: null,
            currentBidAt: null,
          },
        });

        await tx.user.updateMany({
          where: {
            auctionId: { in: auctionIds },
            email: { endsWith: TEST_EMAIL_SUFFIX },
          },
          data: { auctionId: null, teamId: null },
        });

        if (playerIds.length > 0) {
          await tx.player.deleteMany({ where: { id: { in: playerIds } } });
        }
        if (teamIds.length > 0) {
          await tx.team.deleteMany({ where: { id: { in: teamIds } } });
        }

        await tx.auction.deleteMany({ where: { id: { in: auctionIds } } });
      },
      { timeout: 60_000 }
    );
  } catch (err) {
    logger.error({ err, auctionIds }, "Failed to wipe test auctions");
    throw err;
  }

  return testAuctions.length;
}
