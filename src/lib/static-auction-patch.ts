/** Patch helpers — update local auction state without a full refetch. */

export type StaticAuctionDetail = {
  id: string;
  name: string;
  state: string;
  mode: string;
  currentPlayerId: string | null;
  maxSquadSize: number;
  teams: Array<{
    team: {
      id: string;
      name: string;
      wallet: number;
      captain?: string | null;
      logo?: string | null;
    };
  }>;
  players: Array<{
    sortOrder: number;
    player: {
      id: string;
      name: string;
      role: string;
      basePrice: number;
      teamId: string | null;
      isUnsold: boolean;
      photo?: string | null;
      age?: number | null;
      batsmanType?: string | null;
      bowlerType?: string | null;
    };
  }>;
  sales: Array<{
    playerId: string;
    teamId: string;
    price: number;
    player: { name: string; role?: string };
    team: { name: string };
  }>;
  unsoldPlayers: Array<{ playerId: string }>;
};

export function patchAfterSale(
  auction: StaticAuctionDetail,
  data: {
    player: { id: string; name: string; role?: string };
    team: { id: string; name: string; wallet: number };
    price: number;
    currentPlayerId: string | null;
    nextPlayer?: StaticAuctionDetail["players"][number]["player"] | null;
  }
): StaticAuctionDetail {
  const role =
    data.player.role ||
    auction.players.find((p) => p.player.id === data.player.id)?.player.role ||
    "";

  let players = auction.players.map((ap) => {
    if (ap.player.id === data.player.id) {
      return {
        ...ap,
        player: {
          ...ap.player,
          teamId: data.team.id,
          isUnsold: false,
          photo: null,
        },
      };
    }
    if (data.nextPlayer && ap.player.id === data.nextPlayer.id) {
      return { ...ap, player: { ...ap.player, ...data.nextPlayer } };
    }
    if (ap.player.id === data.currentPlayerId && data.currentPlayerId) {
      return { ...ap, player: { ...ap.player, photo: null } };
    }
    return ap;
  });

  return {
    ...auction,
    currentPlayerId: data.currentPlayerId,
    teams: auction.teams.map((at) =>
      at.team.id === data.team.id
        ? { ...at, team: { ...at.team, wallet: data.team.wallet } }
        : at
    ),
    players,
    sales: [
      ...auction.sales,
      {
        playerId: data.player.id,
        teamId: data.team.id,
        price: data.price,
        player: { name: data.player.name, role },
        team: { name: data.team.name },
      },
    ],
  };
}

export function patchAfterUnsold(
  auction: StaticAuctionDetail,
  data: {
    playerId: string;
    currentPlayerId: string | null;
    nextPlayer?: StaticAuctionDetail["players"][number]["player"] | null;
  }
): StaticAuctionDetail {
  const already = auction.unsoldPlayers.some((u) => u.playerId === data.playerId);
  const players = auction.players.map((ap) => {
    if (ap.player.id === data.playerId) {
      return {
        ...ap,
        player: { ...ap.player, isUnsold: true, photo: null },
      };
    }
    if (data.nextPlayer && ap.player.id === data.nextPlayer.id) {
      return { ...ap, player: { ...ap.player, ...data.nextPlayer } };
    }
    return ap;
  });

  return {
    ...auction,
    currentPlayerId: data.currentPlayerId,
    unsoldPlayers: already
      ? auction.unsoldPlayers
      : [...auction.unsoldPlayers, { playerId: data.playerId }],
    players,
  };
}

export function patchAfterUndoSale(
  auction: StaticAuctionDetail,
  data: {
    playerId: string;
    teamId: string;
    teamWallet: number;
    currentPlayerId: string;
  }
): StaticAuctionDetail {
  const players = auction.players.map((ap) => {
    if (ap.player.id === data.playerId) {
      const existing = ap.player;
      return {
        ...ap,
        player: {
          ...existing,
          teamId: null,
          isUnsold: false,
          photo: existing.photo,
        },
      };
    }
    if (ap.player.id !== data.playerId && ap.player.photo) {
      return { ...ap, player: { ...ap.player, photo: null } };
    }
    return ap;
  });

  const withCurrentPhoto = players.map((ap) =>
    ap.player.id === data.currentPlayerId
      ? {
          ...ap,
          player: {
            ...ap.player,
            photo:
              ap.player.photo ??
              auction.players.find((p) => p.player.id === data.playerId)?.player
                .photo ??
              null,
          },
        }
      : ap
  );

  return {
    ...auction,
    currentPlayerId: data.currentPlayerId,
    teams: auction.teams.map((at) =>
      at.team.id === data.teamId
        ? { ...at, team: { ...at.team, wallet: data.teamWallet } }
        : at
    ),
    players: withCurrentPhoto,
    sales: auction.sales.filter((s) => s.playerId !== data.playerId),
  };
}

export function patchAfterUndoUnsold(
  auction: StaticAuctionDetail,
  data: { playerId: string; currentPlayerId: string }
): StaticAuctionDetail {
  return {
    ...auction,
    currentPlayerId: data.currentPlayerId,
    unsoldPlayers: auction.unsoldPlayers.filter(
      (u) => u.playerId !== data.playerId
    ),
    players: auction.players.map((ap) =>
      ap.player.id === data.playerId
        ? { ...ap, player: { ...ap.player, isUnsold: false } }
        : ap
    ),
  };
}

export function patchCurrentPlayer(
  auction: StaticAuctionDetail,
  playerId: string,
  playerSnapshot?: StaticAuctionDetail["players"][number]["player"] | null
): StaticAuctionDetail {
  const players = auction.players.map((ap) => {
    if (playerSnapshot && ap.player.id === playerSnapshot.id) {
      return { ...ap, player: { ...ap.player, ...playerSnapshot } };
    }
    if (ap.player.id === playerId) {
      return {
        ...ap,
        player: {
          ...ap.player,
          ...(playerSnapshot || {}),
          photo: playerSnapshot?.photo ?? ap.player.photo,
        },
      };
    }
    if (ap.player.photo && ap.player.id !== playerId) {
      return { ...ap, player: { ...ap.player, photo: null } };
    }
    return ap;
  });

  return { ...auction, currentPlayerId: playerId, players };
}

export function patchAuctionState(
  auction: StaticAuctionDetail,
  state: string,
  currentPlayerId: string | null = auction.currentPlayerId
): StaticAuctionDetail {
  return { ...auction, state, currentPlayerId };
}
