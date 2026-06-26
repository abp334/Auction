/** Fixed test data for super-admin one-click auction setup. */

export const TEST_AUCTION_DOMAIN = "test.clashbid";

export function isTestParticipantEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${TEST_AUCTION_DOMAIN}`);
}

export function buildTestAuctionPayload() {
  const teams = [
    {
      name: "Test Team Alpha",
      wallet: 10_000_000,
      logo: "🦁",
      owner: "Test Owner",
      captain: "Captain Alpha",
      captainEmail: `captain.alpha@${TEST_AUCTION_DOMAIN}`,
    },
    {
      name: "Test Team Beta",
      wallet: 10_000_000,
      logo: "🐯",
      owner: "Test Owner",
      captain: "Captain Beta",
      captainEmail: `captain.beta@${TEST_AUCTION_DOMAIN}`,
    },
    {
      name: "Test Team Gamma",
      wallet: 10_000_000,
      logo: "🦅",
      owner: "Test Owner",
      captain: "Captain Gamma",
      captainEmail: `captain.gamma@${TEST_AUCTION_DOMAIN}`,
    },
    {
      name: "Test Team Delta",
      wallet: 10_000_000,
      logo: "🐬",
      owner: "Test Owner",
      captain: "Captain Delta",
      captainEmail: `captain.delta@${TEST_AUCTION_DOMAIN}`,
    },
  ];

  const roles = [
    "Batsman",
    "Bowler",
    "All-Rounder",
    "Wicketkeeper-Batsman",
  ] as const;

  const players = Array.from({ length: 12 }, (_, i) => {
    const role = roles[i % roles.length];
    const isBowler = role === "Bowler" || role === "All-Rounder";
    return {
      name: `Test Player ${i + 1}`,
      role,
      basePrice: 1000 + (i % 4) * 1000,
      age: 22 + (i % 8),
      photo: "",
      batsmanType:
        role === "Bowler" ? "" : "Right-Hand Batsman",
      bowlerType: isBowler ? "Right Arm Medium" : "None",
      mobile: "",
      email: `player${i + 1}@${TEST_AUCTION_DOMAIN}`,
    };
  });

  return {
    name: "ClashBid Test Auction",
    teams,
    players,
  };
}

export function buildTestCredentials(
  payload: ReturnType<typeof buildTestAuctionPayload>,
  buildCaptainPassword: (teamName: string) => string,
  buildPlayerPassword: (playerName: string) => string
) {
  return {
    captains: payload.teams.map((t) => ({
      team: t.name,
      email: t.captainEmail,
      password: buildCaptainPassword(t.name),
    })),
    players: payload.players.map((p) => ({
      name: p.name,
      email: p.email,
      password: buildPlayerPassword(p.name),
    })),
  };
}
