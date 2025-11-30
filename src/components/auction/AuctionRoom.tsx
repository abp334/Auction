import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Gavel, Clock, Trophy, User } from "lucide-react";
import { Progress } from "@/components/ui/progress";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import confetti from "canvas-confetti";
import { io, Socket } from "socket.io-client";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface AuctionRoomProps {
  role: "captain" | "player";
  roomCode: string;
  onExit: () => void;
}

interface Player {
  id: string;
  name: string;
  photo: string;
  currentBid: number;
  age: number;
  batsmanType: string;
  bowlerType: string;
}

interface Team {
  id: string;
  name: string;
  logo: string;
  captain: string;
  purse: number;
  players: number;
}

const AuctionRoom = ({ role, roomCode, onExit }: AuctionRoomProps) => {
  const { toast } = useToast();
  const { user } = useAuth();

  // State
  const [timeLeft, setTimeLeft] = useState(30);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [presentTeamIds, setPresentTeamIds] = useState<string[]>([]);
  const [commentary, setCommentary] = useState<string[]>([
    "Auction started! Waiting for data...",
  ]);
  const [lastBidTeam, setLastBidTeam] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasSkipped, setHasSkipped] = useState(false);
  const [myTeamPlayers, setMyTeamPlayers] = useState<Player[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [auctionId, setAuctionId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [auction, setAuction] = useState<any>(null);

  // Action States
  const [isBidding, setIsBidding] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  // Refs
  const teamsRef = useRef<Team[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const bidTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const auctionEndTimeRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Helper: Fetch My Players (if captain)
  const loadMyPlayers = useCallback(async () => {
    if (role === "captain" && user?.teamId) {
      try {
        // Fetch players assigned to my team
        const pRes = await apiFetch(`/players?teamId=${user.teamId}`);
        if (pRes.ok) {
          const { players } = await pRes.json();
          setMyTeamPlayers(
            players.map((p: any) => ({
              id: p._id,
              name: p.name,
              photo: p.photo || "",
              currentBid: p.basePrice || 0,
              age: p.age || 25,
              batsmanType: p.role || "",
              bowlerType: p.bowlerType || "Not a Bowler",
            }))
          );
        }
      } catch (err) {
        console.error("Error loading my players", err);
      }
    }
  }, [role, user]);

  // Helper: Fetch Teams
  const loadTeams = useCallback(async () => {
    try {
      const tRes = await apiFetch("/teams");
      if (tRes.ok) {
        const { teams } = await tRes.json();
        const mappedTeams = teams.map((t: any) => ({
          id: t._id,
          name: t.name,
          logo: t.logo || "🏆",
          captain: t.captain || "",
          purse: t.wallet || 0,
          players: 0,
        }));
        setTeams(mappedTeams);
        teamsRef.current = mappedTeams;

        if (role === "captain" && user?.teamId) {
          const myTeam = mappedTeams.find((t: any) => t.id === user.teamId);
          setMyTeamId(myTeam ? myTeam.id : user.teamId);
        }
      }
    } catch (e) {
      console.error("Error loading teams", e);
    }
  }, [role, user]);

  // Helper: Sync Auction State (Clock & Bids)
  const fetchLatestAuctionState = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/auctions?roomCode=${encodeURIComponent(roomCode)}`
      );
      if (!res.ok) return;
      const { auctions } = await res.json();
      const a = auctions[0];
      if (!a) return;

      setAuctionId(a._id);
      setAuction(a);

      // SYNC CLOCK: Use absolute server time
      if (a.timerEndsAt && a.state === "active") {
        auctionEndTimeRef.current = new Date(a.timerEndsAt).getTime();
      } else if (a.state === "active" && a.currentPlayerId) {
        // Fallback for manual start where timerEndsAt might not be set initially
        auctionEndTimeRef.current = Date.now() + (a.timerDuration || 30) * 1000;
      } else {
        auctionEndTimeRef.current = null;
        setTimeLeft(0);
      }

      if (a.currentBid) {
        setLastBidTeam(a.currentBid.teamId);
      } else {
        setLastBidTeam(null);
      }

      // Load current player
      if (a.currentPlayerId) {
        const pRes = await apiFetch(`/players/${a.currentPlayerId}`);
        if (pRes.ok) {
          const { player } = await pRes.json();
          setCurrentPlayer({
            id: player._id,
            name: player.name,
            photo: player.photo || "",
            currentBid: a.currentBid?.amount || player.basePrice || 1000,
            age: player.age || 25,
            batsmanType: player.role || "",
            bowlerType: player.bowlerType || "Not a Bowler",
          });
        }
      } else {
        setCurrentPlayer(null);
      }
    } catch (err) {
      console.error("Failed to fetch latest auction state", err);
    }
  }, [roomCode]);

  // Initial Load & Cleanup
  useEffect(() => {
    const init = async () => {
      await loadTeams();
      await fetchLatestAuctionState();
      setCommentary((prev) =>
        [`Joined Room ${roomCode}`, ...prev].slice(0, 10)
      );
    };
    init();

    // Load captain's players
    loadMyPlayers();
  }, [roomCode, loadTeams, fetchLatestAuctionState, loadMyPlayers]);

  // Socket Connection
  useEffect(() => {
    // ⚠️ REPLACE THIS STRING with your actual Render/Railway backend URL
    // Do NOT include /api/v1 at the end. It should look like: "https://bidarena-backend.onrender.com"
    const backendUrl = "https://auction-nsx0.onrender.com";

    console.log("Connecting to Socket.IO at:", backendUrl); // Debug log

    import("@/lib/api").then(({ getAccessToken }) => {
      const token = getAccessToken ? getAccessToken() : null;

      const s = io(backendUrl, {
        withCredentials: true,
        transports: ["websocket", "polling"], // Force these transports
        auth: { token },
      });
      s.on("connect", () => {
        s.emit("auction:join", roomCode);
      });

      s.on("auction:bid_update", (e: any) => {
        const team = teamsRef.current.find((t) => t.id === e.teamId);
        const teamName = team ? team.name : `Team ${e.teamId.substring(0, 4)}`;

        setCommentary((prev) =>
          [`Bid: $${e.amount.toLocaleString()} by ${teamName}`, ...prev].slice(
            0,
            10
          )
        );

        // Crucial Fix: Rely solely on the server's broadcast for the canonical bid amount
        setCurrentPlayer((p) => (p ? { ...p, currentBid: e.amount } : null));
        setLastBidTeam(e.teamId);

        auctionEndTimeRef.current = Date.now() + 30000;
      });

      s.on("auction:timer", (e: any) => {
        if (e.endTime) {
          auctionEndTimeRef.current = e.endTime;
        } else if (e.timeLeft) {
          auctionEndTimeRef.current = Date.now() + e.timeLeft * 1000;
        }
      });

      s.on("auction:player_changed", (e: any) => {
        setCommentary((prev) =>
          [`Next Player: ${e.player.name}`, ...prev].slice(0, 10)
        );
        setCurrentPlayer({
          id: e.player.id,
          name: e.player.name,
          photo: e.player.photo || "",
          currentBid: e.player.basePrice || 1000,
          age: e.player.age || 25,
          batsmanType: e.player.role || "",
          bowlerType: e.player.bowlerType || "Not a Bowler",
        });
        setHasSkipped(false);
        setLastBidTeam(null);

        if (e.timerEndTime) {
          auctionEndTimeRef.current = e.timerEndTime;
        }
      });

      s.on("auction:sale", (e: any) => {
        const teamName =
          teamsRef.current.find((t) => t.id === e.teamId)?.name ||
          "Unknown Team";
        setCommentary((prev) =>
          [
            `SOLD! ${
              e.playerName
            } to ${teamName} for $${e.price.toLocaleString()}`,
            ...prev,
          ].slice(0, 10)
        );

        auctionEndTimeRef.current = null;
        setTimeLeft(0);
        setCurrentPlayer(null); // Clear player immediately, wait for next player event

        // Crucial Fix: Reload data to update purses and my players list
        loadTeams();
        loadMyPlayers();
      });

      s.on("auction:unsold", (e: any) => {
        setCommentary((prev) =>
          [`UNSOLD: ${e.playerName}`, ...prev].slice(0, 10)
        );
        auctionEndTimeRef.current = null;
        setTimeLeft(0);
        setCurrentPlayer(null); // Clear player immediately, wait for next player event

        // Crucial Fix: Reload teams to ensure correct UI state
        loadTeams();
      });

      s.on("auction:bid_undo", (e: any) => {
        setCommentary((prev) =>
          [`${e.teamName} withdrew their bid.`, ...prev].slice(0, 10)
        );
        // Sync bid amount from server's payload
        if (e.currentBid) {
          setCurrentPlayer((p) =>
            p ? { ...p, currentBid: e.currentBid.amount } : null
          );
          setLastBidTeam(e.currentBid.teamId);
        } else {
          // If currentBid is null/undefined after undo, reset to base price (or 1000)
          setCurrentPlayer((p) => (p ? { ...p, currentBid: 1000 } : null));
          setLastBidTeam(null);
        }

        // Reload teams to ensure purse is updated after undo
        loadTeams();
        loadMyPlayers();
      });

      s.on("auction:skip", (e: any) => {
        const teamName =
          teamsRef.current.find((t) => t.id === e.teamId)?.name ||
          "Unknown Team";
        setCommentary((prev) =>
          [
            `${teamName} skipped player ${currentPlayer?.name || e.playerId}.`,
            ...prev,
          ].slice(0, 10)
        );
      });

      s.on("auction:ended", (e: any) => {
        setCommentary((prev) => ["Auction Ended by Admin", ...prev]);
        setTimeout(onExit, 3000);
      });

      socketRef.current = s;
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomCode, loadTeams, loadMyPlayers, onExit, currentPlayer?.name]);

  // Local Timer Tick (No change needed)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!auctionEndTimeRef.current) {
        if (timeLeft !== 0) setTimeLeft(0);
        return;
      }
      const diff = auctionEndTimeRef.current - Date.now();
      const secs = Math.max(0, Math.floor(diff / 1000));
      setTimeLeft(secs);
    }, 100);
    return () => clearInterval(interval);
  }, [timeLeft]);

  // Handlers
  const handleBid = async () => {
    // 1. Guard clause: Ensure we have all necessary data
    if (!auctionId || !currentPlayer || isBidding || !myTeamId) return;

    setIsBidding(true);
    const newBid = (currentPlayer.currentBid || 0) + 1000;

    try {
      // 2. CHANGE: Always use REST API for bidding.
      // This ensures the auth token is refreshed automatically via apiFetch if it expired.
      // The socket.emit method does not handle 401/refresh logic, which is why your bids were failing silently.
      await apiFetch(`/auctions/${auctionId}/bid`, {
        method: "POST",
        body: JSON.stringify({ amount: newBid, teamId: myTeamId }),
      });

      // Note: We do NOT need to manually update state here.
      // The server will process the POST request and emit 'auction:bid_update' via Socket.IO.
      // Your useEffect listener will catch that and update the UI for everyone simultaneously.
    } catch (e) {
      console.error("Bid error", e);
      toast({
        title: "Bid Failed",
        description: "Could not place bid. Please check your connection.",
        variant: "destructive",
      });
      await fetchLatestAuctionState();
    } finally {
      setTimeout(() => setIsBidding(false), 500);
    }
  };
  const handleSkip = async () => {
    if (!auctionId || isSkipping) return;
    setIsSkipping(true);
    try {
      const res = await apiFetch(`/auctions/${auctionId}/skip`, {
        method: "POST",
      });
      if (res.ok) {
        setHasSkipped(true);
        toast({
          title: "Skipped",
          description: "You have skipped this player.",
        });
      } else {
        toast({
          title: "Skip Failed",
          description: "Could not skip player.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSkipping(false);
    }
  };

  const handleUndo = async () => {
    if (!auctionId || isUndoing) return;
    setIsUndoing(true);

    if (!myTeamId || lastBidTeam !== myTeamId) {
      toast({
        title: "Cannot Undo",
        description: "Not your bid or another team has bid after you.",
        variant: "destructive",
      });
      setIsUndoing(false);
      return;
    }

    try {
      const res = await apiFetch(`/auctions/${auctionId}/undo-bid`, {
        method: "POST",
      });
      if (res.ok) {
        toast({ title: "Bid Undone", description: "Bid withdrawn" });
      } else {
        // If server rejects undo, re-sync state
        await fetchLatestAuctionState();
        toast({
          title: "Undo Failed",
          description: "Server rejected the undo request. Status updated.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Undo Failed",
        description: "Network error during undo.",
        variant: "destructive",
      });
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#0f1419] text-white">
      <header className="border-b border-amber-500/30 bg-[#0f1419]/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="secondary" size="sm" onClick={onExit}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Exit
            </Button>
            <div>
              <p className="text-sm text-amber-400/75">Room Code</p>
              <p className="text-lg font-bold tracking-wider text-amber-400">
                {roomCode}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/75">Mode</p>
            <p className="text-lg font-bold text-white">
              {role === "captain" ? "Captain" : "Spectator"}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr,350px] gap-6">
          <div className="flex flex-col gap-4">
            <Card
              className={`border-4 bg-[#0f1419] ${
                showCelebration ? "border-amber-500" : "border-amber-500/50"
              }`}
            >
              <CardContent className="flex flex-col items-center justify-center p-8 min-h-[500px]">
                {!currentPlayer ? (
                  <div className="text-center space-y-6">
                    <Clock className="w-24 h-24 mx-auto text-amber-400 opacity-75 animate-pulse" />
                    <h2 className="text-3xl font-bold text-white">
                      Waiting for next player...
                    </h2>
                  </div>
                ) : (
                  <>
                    {currentPlayer.photo ? (
                      <img
                        src={currentPlayer.photo}
                        className="w-40 h-40 rounded-full object-cover mb-6 border-4 border-amber-500/50"
                        alt={currentPlayer.name}
                      />
                    ) : (
                      <User className="w-40 h-40 mb-6 text-gray-400" />
                    )}
                    <h2 className="text-4xl font-bold mb-2 text-white">
                      {currentPlayer.name}
                    </h2>

                    <div className="flex gap-4 text-sm mb-8 justify-center">
                      <span className="bg-amber-500/20 px-3 py-1 rounded-full text-white">
                        Age: {currentPlayer.age}
                      </span>
                      <span className="bg-blue-500/20 px-3 py-1 rounded-full text-white">
                        ⚾ {currentPlayer.batsmanType}
                      </span>
                      <span className="bg-green-500/20 px-3 py-1 rounded-full text-white">
                        🏏 {currentPlayer.bowlerType}
                      </span>
                    </div>

                    <div className="w-full max-w-md space-y-6">
                      <div className="text-center bg-amber-500/10 p-6 rounded-xl border border-amber-500/30">
                        <p className="text-sm text-amber-400/75 mb-2">
                          Current Bid
                        </p>
                        <p className="text-6xl font-bold text-amber-400">
                          {currentPlayer.currentBid.toLocaleString()} Points
                        </p>
                      </div>

                      <div className="space-y-3 bg-[#1a2332]/60 p-4 rounded-xl border border-amber-500/20">
                        <div className="flex items-center justify-between text-sm text-white">
                          <span className="flex items-center gap-2">
                            <Clock className="w-5 h-5" /> Time Remaining
                          </span>
                          <span className="font-bold text-xl">{timeLeft}s</span>
                        </div>
                        <Progress
                          value={(timeLeft / 30) * 100}
                          className="h-3"
                        />
                      </div>

                      {role === "captain" && !hasSkipped && (
                        <div className="grid grid-cols-3 gap-3 pt-2">
                          <Button
                            size="lg"
                            onClick={handleBid}
                            // FIX: Disable button if myTeamId or currentPlayer is missing
                            disabled={
                              isBidding ||
                              timeLeft === 0 ||
                              !myTeamId ||
                              !currentPlayer
                            }
                            className="bg-green-600 hover:bg-green-700 h-14 text-lg font-bold"
                          >
                            <Gavel className="w-5 h-5 mr-2" />{" "}
                            {isBidding ? "..." : "Bid"}
                          </Button>
                          <Button
                            size="lg"
                            onClick={handleSkip}
                            disabled={isSkipping}
                            className="bg-amber-600 hover:bg-amber-700 h-14 text-lg font-bold border-2 border-amber-500 text-white"
                          >
                            {isSkipping ? "..." : "Skip"}
                          </Button>
                          <Button
                            size="lg"
                            variant="destructive"
                            onClick={handleUndo}
                            disabled={
                              isUndoing ||
                              !lastBidTeam ||
                              lastBidTeam !== myTeamId
                            }
                            className="h-14 font-bold"
                          >
                            {isUndoing ? "..." : "Undo"}
                          </Button>
                        </div>
                      )}
                      {hasSkipped && (
                        <p className="text-center text-red-400">
                          You skipped this player
                        </p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-amber-500/50 bg-[#0f1419]">
              <CardContent className="p-4">
                <h3 className="font-bold mb-2 flex items-center gap-2 text-white">
                  <Trophy className="w-4 h-4 text-amber-400" /> Live Commentary
                </h3>
                <div className="space-y-1 text-sm max-h-32 overflow-y-auto scrollbar-hide">
                  {commentary.map((c, i) => (
                    <p
                      key={i}
                      className="text-white/90 border-b border-white/5 pb-1"
                    >
                      {c}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-amber-500/50 bg-[#0f1419]">
              <CardContent className="p-4">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-white">
                  <Trophy className="w-5 h-5 text-amber-400" /> Teams
                </h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className={`p-3 rounded border ${
                        team.id === myTeamId
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-white/10 bg-[#1a2332]/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🏆</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white truncate">
                            {team.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {team.captain || "No Captain"}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-400 font-bold">
                          ${team.purse.toLocaleString()}
                        </span>
                        <span className="text-gray-300">
                          {team.players} Players
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/50 bg-[#0f1419]">
              <CardContent className="p-4">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-white">
                  <User className="w-5 h-5 text-amber-400" /> My Team Players
                </h3>
                {myTeamPlayers.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">No players yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {myTeamPlayers.map((player) => (
                      <div
                        key={player.id}
                        className="p-3 bg-[#1a2332]/60 backdrop-blur-sm rounded-lg border border-white/10"
                      >
                        <div className="flex items-center gap-3">
                          {player.photo ? (
                            <img
                              src={player.photo}
                              alt={player.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-3xl">👤</span>
                          )}
                          <div className="flex-1">
                            <p className="font-semibold text-white">
                              {player.name}
                            </p>
                            <div className="flex gap-2 text-xs text-gray-400 mt-1">
                              <span>Age: {player.age}</span>
                              <span>⚾ {player.batsmanType}</span>
                            </div>
                            <p className="text-amber-400 text-sm font-bold mt-1">
                              ${player.currentBid.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuctionRoom;
