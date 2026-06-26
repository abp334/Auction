import "dotenv/config";
import prisma from "../src/utils/db.js";

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { email: true },
    take: 5,
  });
  const testAuctions = await prisma.auction.count({
    where: {
      OR: [{ isTest: true }, { name: "ClashBid Test Auction" }],
    },
  });
  const testUsers = await prisma.user.count({
    where: { email: { endsWith: "@test.clashbid" } },
  });
  console.log("admins:", admins.map((a) => a.email));
  console.log("test auctions:", testAuctions);
  console.log("test users:", testUsers);
  await prisma.$disconnect();
}

main();
