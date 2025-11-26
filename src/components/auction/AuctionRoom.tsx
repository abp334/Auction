import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Gavel, Clock, Trophy, User, Ban } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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
  const [presentTeamIds, setPresentTeamIds] = useState<string[]>([]);
  const [commentary, setCommentary] = useState<string[]>([
    "Auction started! First player up for bidding.",
  ]);
  const [lastBidTeam, setLastBidTeam] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasSkipped, setHasSkipped] = useState(false);
  const [myTeamPlayers, setMyTeamPlayers] = useState<Player[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [auctionId, setAuctionId] = useState<string | null>(null);
  const [auction, setAuction] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Action States
  const [isBidding, setIsBidding] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  // Refs for stability in callbacks/intervals
  const teamsRef = useRef<Team[]>([]);
  const bidTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // CRITICAL: Timer Refs to prevent re-render loops
  const auctionEndTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Initial Data Load
    (async () => {
      const res = await apiFetch(
        `/auctions?roomCode=${encodeURIComponent(roomCode)}`
      );
      if (!res.ok) return;
      const { auctions } = await res.json();
      const a = auctions[0];
      if (!a) return;
      setAuctionId(a._id);
      setAuction(a);
      setCommentary([`Auction loaded. Room ${a.roomCode}`, ...commentary]);

      // Fetch teams
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

        // Find captain's team
        if (role === "captain" && user?.teamId) {
          const myTeam = teams.find((t: any) => t._id === user.teamId);
          if (myTeam) {
            setMyTeamId(myTeam._id);
          } else {
            setMyTeamId(user.teamId);
          }
        }
      }

      // Load current player if set
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
      }

      // Load purchased players for my team
      if (role === "captain" && myTeamId) {
        const pRes = await apiFetch(`/players?teamId=${myTeamId}`);
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
      }
    })();

    // Socket Connection
    const backendUrl =
      import.meta.env.VITE_SERVER_URL ||
      (typeof window !== "undefined" && window.location.origin) ||
      "http://localhost:5001";

    let s: Socket | null = null;
    import("@/lib/api").then(({ getAccessToken }) => {
      const token = getAccessToken ? getAccessToken() : null;
      s = io(backendUrl, {
        withCredentials: true,
        transports: ["websocket", "polling"],
        auth: { token },
      });

      s.emit("auction:join", roomCode);

      // --- SOCKET EVENT LISTENERS ---

      s.on("auction:bid_update", (e: any) => {
        const team = teamsRef.current.find((t) => t.id === e.teamId);
        const teamName =
          team?.name || `Team ${e.teamId?.substring(0, 6) || "Unknown"}`;

        setCommentary((prev) =>
          [`Bid: $${e.amount.toLocaleString()} by ${teamName}`, ...prev].slice(
            0,
            10
          )
        );
        setCurrentPlayer((p) => (p ? { ...p, currentBid: e.amount } : null));
        setAuction((prev: any) =>
          prev
            ? { ...prev, currentBid: { amount: e.amount, teamId: e.teamId } }
            : null
        );
        setLastBidTeam(e.teamId);

        // Optimistic Timer Extension on Bid (Server will confirm via auction:timer)
        // Resetting to 30s locally to feel responsive immediately
        const newTarget = Date.now() + 30000;
        auctionEndTimeRef.current = newTarget;
      });

      s.on(
        "auction:timer",
        (e: { endTime?: number; timeLeft?: number; totalTime?: number }) => {
          // PREFERRED: Use absolute endTime from server
          if (e.endTime) {
            auctionEndTimeRef.current = e.endTime;
          }
          // FALLBACK: Calculate based on timeLeft
          else if (typeof e.timeLeft === "number") {
            auctionEndTimeRef.current = Date.now() + e.timeLeft * 1000;
          }
        }
      );

      s.on("auction:player_changed", (e: any) => {
        setCommentary((prev) =>
          [`New player: ${e.player.name}`, ...prev].slice(0, 10)
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
        setAuction((prev: any) =>
          prev ? { ...prev, currentBid: undefined } : null
        );

        // Sync Timer immediately
        if (e.timerEndTime) {
          auctionEndTimeRef.current = e.timerEndTime;
        } else if (e.remainingTime) {
          auctionEndTimeRef.current = Date.now() + e.remainingTime * 1000;
        }
      });

      s.on("auction:sale", async (e: any) => {
        // Refresh teams
        const tRes = await apiFetch("/teams");
        if (tRes.ok) {
          const { teams: freshTeams } = await tRes.json();
          const mappedTeams = freshTeams.map((t: any) => ({
            id: t._id,
            name: t.name,
            logo: t.logo || "🏆",
            captain: t.captain || "",
            purse: t.wallet || 0,
            players: 0,
          }));
          setTeams(mappedTeams);
          teamsRef.current = mappedTeams;

          const teamName =
            e.teamName ||
            mappedTeams.find((t) => t.id === e.teamId)?.name ||
            "Unknown";
          const playerName = e.playerName || currentPlayer?.name || "Player";

          setCommentary((prev) =>
            [
              `${playerName} goes to ${teamName} for $${e.price.toLocaleString()}`,
              ...prev,
            ].slice(0, 10)
          );
        }

        if (e.teamId === myTeamId) {
          apiFetch(`/players?teamId=${myTeamId}`).then(async (res) => {
            if (res.ok) {
              const { players } = await res.json();
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
          });
        }

        // Stop timer visual
        auctionEndTimeRef.current = null;
        setTimeLeft(0);
      });

      s.on("auction:presence", (e: any) => {
        if (!e.teamId || e.role !== "captain") return;
        setPresentTeamIds((prev) => {
          const exists = prev.includes(e.teamId);
          if (e.joined && !exists) return [...prev, e.teamId];
          if (!e.joined && exists) return prev.filter((id) => id !== e.teamId);
          return prev;
        });
      });

      s.on("auction:bid_undo", (e: any) => {
        setCommentary((prev) =>
          [`${e.teamName} withdrew their bid.`, ...prev].slice(0, 10)
        );
        if (e.currentBid) {
          setCurrentPlayer((p) =>
            p ? { ...p, currentBid: e.currentBid.amount } : null
          );
          setAuction((prev: any) =>
            prev ? { ...prev, currentBid: e.currentBid } : null
          );
          setLastBidTeam(e.currentBid.teamId);
        } else {
          setCurrentPlayer((p) => (p ? { ...p, currentBid: 1000 } : null));
          setAuction((prev: any) =>
            prev ? { ...prev, currentBid: undefined } : null
          );
          setLastBidTeam(null);
        }
      });

      s.on("auction:skip", (e: any) => {
        setCommentary((prev) =>
          [`${e.teamName} skipped this player.`, ...prev].slice(0, 10)
        );
        if (e.teamId === myTeamId || e.teamId === user?.teamId) {
          setHasSkipped(true);
        }
      });

      s.on("auction:unsold", (e: any) => {
        setCommentary((prev) =>
          [`${e.playerName} went unsold.`, ...prev].slice(0, 10)
        );
        auctionEndTimeRef.current = null;
        setTimeLeft(0);
      });

      s.on("auction:completed", (e: any) => {
        setCommentary((prev) =>
          [e.message || "Auction completed!", ...prev].slice(0, 10)
        );
        setCurrentPlayer(null);
        setAuction((prev: any) =>
          prev ? { ...prev, state: "completed" } : null
        );
        toast({
          title: "Auction Completed",
          description: "All players have been sold!",
        });
      });

      s.on("auction:ended", (e: any) => {
        setCommentary((prev) =>
          [e.message || "Auction ended by admin", ...prev].slice(0, 10)
        );
        setCurrentPlayer(null);
        setAuction((prev: any) =>
          prev ? { ...prev, state: "completed" } : null
        );
        setTimeout(() => onExit(), 2000);
      });

      setSocket(s);
    });

    return () => {
      if (s) {
        s.emit("auction:leave", roomCode);
        s.disconnect();
      }
    };
  }, [roomCode, role, user, myTeamId]);

  // Keep ref in sync
  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  // --- LOCAL TIMER INTERVAL ---
  // This runs independently of server ticks. It just looks at the Target Time.
  useEffect(() => {
    const interval = setInterval(() => {
      const target = auctionEndTimeRef.current;

      if (!target) {
        setTimeLeft(0);
        return;
      }

      const diff = target - Date.now();
      const seconds = Math.max(0, Math.floor(diff / 1000));

      setTimeLeft(seconds);

      // If time is up locally, we wait for server to send 'sold' or 'unsold'
      // We don't trigger logic here to avoid race conditions
    }, 200); // Check 5 times a second for smoothness

    return () => clearInterval(interval);
  }, []);

  const handleBid = async () => {
    const teamId = myTeamId || user?.teamId;
    if (!auctionId || !currentPlayer || !teamId) {
      toast({
        title: "Error",
        description: "Cannot bid: missing auction or team",
        variant: "destructive",
      });
      return;
    }
    if (isBidding) return;
    if (bidTimeoutRef.current) return;

    setIsBidding(true);
    bidTimeoutRef.current = setTimeout(() => {
      bidTimeoutRef.current = null;
    }, 1000);

    const newBid = Math.max(1000, (currentPlayer.currentBid || 1000) + 1000);
    const optimisticBid = newBid;
    const optimisticTeamId = teamId;

    // Optimistic Updates
    setCurrentPlayer((p) => (p ? { ...p, currentBid: optimisticBid } : null));
    setAuction((prev: any) =>
      prev
        ? {
            ...prev,
            currentBid: { amount: optimisticBid, teamId: optimisticTeamId },
          }
        : null
    );
    setLastBidTeam(optimisticTeamId);

    const teamName =
      teamsRef.current.find((t) => t.id === optimisticTeamId)?.name ||
      "Your team";
    setCommentary((prev) =>
      [`Bid: $${optimisticBid.toLocaleString()} by ${teamName}`, ...prev].slice(
        0,
        10
      )
    );

    // Optimistically extend timer to 30s
    auctionEndTimeRef.current = Date.now() + 30000;

    try {
      if (socket) {
        socket.emit("auction:bid", {
          auctionId,
          roomCode,
          amount: newBid,
          teamId,
          playerId: currentPlayer.id,
        });
        toast({
          title: "Bid Sent",
          description: `$${newBid.toLocaleString()}`,
        });
      } else {
        // Fallback HTTP
        const res = await apiFetch(`/auctions/${auctionId}/bid`, {
          method: "POST",
          body: JSON.stringify({
            amount: newBid,
            teamId,
            playerId: currentPlayer.id,
          }),
        });
        if (!res.ok) throw new Error("Bid failed");
      }
    } catch (err) {
      // Revert Optimistic
      const previousBid =
        auction?.currentBid?.amount || currentPlayer.currentBid - 1000 || 1000;
      setCurrentPlayer((p) => (p ? { ...p, currentBid: previousBid } : null));
      setAuction((prev: any) =>
        prev ? { ...prev, currentBid: auction?.currentBid } : null
      );
      toast({
        title: "Bid failed",
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setIsBidding(false);
      if (bidTimeoutRef.current) {
        clearTimeout(bidTimeoutRef.current);
        bidTimeoutRef.current = null;
      }
    }
  };

  const handleSkip = async () => {
    if (!auctionId || isSkipping) return;
    setIsSkipping(true);
    setHasSkipped(true);

    try {
      const res = await apiFetch(`/auctions/${auctionId}/skip`, {
        method: "POST",
      });
      if (res.ok) {
        toast({ title: "Player Skipped", description: "You've opted out" });
      } else {
        setHasSkipped(false);
      }
    } catch (err) {
      setHasSkipped(false);
    } finally {
      setIsSkipping(false);
    }
  };

  const handleUndo = async () => {
    if (!auctionId || isUndoing) return;
    setIsUndoing(true);
    const teamId = myTeamId || user?.teamId;

    if (!teamId || lastBidTeam !== teamId) {
      toast({
        title: "Cannot Undo",
        description: "Not your bid",
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
      }
    } catch (err) {
      console.error(err);
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
              {role === "captain" ? "Bidding" : "Spectator"}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr,350px] gap-6">
          <div className="flex flex-col gap-4">
            <Card
              className={`border-4 bg-[#0f1419] ${
                showCelebration
                  ? "celebration auction-glow border-amber-500"
                  : "border-amber-500/50"
              }`}
            >
              <CardContent className="flex flex-col items-center justify-center p-8 min-h-[500px]">
                {!currentPlayer ? (
                  <div className="text-center space-y-6">
                    {auction?.state === "completed" ? (
                      <>
                        <Trophy className="w-24 h-24 mx-auto text-amber-400 opacity-75" />
                        <div>
                          <h2 className="text-3xl font-bold mb-2 text-white">
                            Auction Ended
                          </h2>
                          <p className="text-white/70 text-lg">
                            All players sold!
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Clock className="w-24 h-24 mx-auto text-amber-400 opacity-75 animate-pulse" />
                        <div>
                          <h2 className="text-3xl font-bold mb-2 text-white">
                            Selecting Next Player...
                          </h2>
                        </div>
                      </>
                    )}
                  </div>
                ) : hasSkipped && role === "captain" ? (
                  <div className="text-center space-y-6">
                    <Ban className="w-24 h-24 mx-auto text-amber-400 opacity-75" />
                    <div>
                      <h2 className="text-3xl font-bold mb-2 text-white">
                        You Skipped This Player
                      </h2>
                      <p className="text-white/70 text-lg">
                        Waiting for bids...
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {currentPlayer?.photo ? (
                      <img
                        src={currentPlayer.photo}
                        alt={currentPlayer.name}
                        className="w-40 h-40 rounded-full object-cover mb-6 border-4 border-amber-500/50"
                      />
                    ) : (
                      <span className="text-9xl mb-6">👤</span>
                    )}
                    <h2 className="text-4xl font-bold mb-2 text-white">
                      {currentPlayer.name}
                    </h2>
                    <div className="flex flex-wrap gap-4 text-sm mb-8 text-white/90 justify-center">
                      <span className="bg-amber-500/20 px-3 py-1 rounded-full">
                        Age: {currentPlayer?.age || "N/A"}
                      </span>
                      <span className="bg-blue-500/20 px-3 py-1 rounded-full">
                        🏏 {currentPlayer?.batsmanType || "N/A"}
                      </span>
                      <span className="bg-green-500/20 px-3 py-1 rounded-full">
                        ⚡ {currentPlayer?.bowlerType || "N/A"}
                      </span>
                    </div>

                    <div className="w-full max-w-md space-y-6">
                      <div className="text-center bg-amber-500/10 p-6 rounded-xl border border-amber-500/30">
                        <p className="text-sm text-amber-400/75 mb-2">
                          Current Bid
                        </p>
                        <p className="text-6xl font-bold text-amber-400">
                          ${(currentPlayer?.currentBid || 0).toLocaleString()}
                        </p>
                      </div>

                      <div className="space-y-3 bg-[#1a2332]/60 p-4 rounded-xl border border-amber-500/20">
                        <div className="flex items-center justify-between text-sm text-white">
                          <span className="flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            <span className="font-semibold">
                              Time Remaining
                            </span>
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
                            disabled={isBidding}
                            className="bg-green-600 hover:bg-green-700 text-white text-lg h-14 font-bold disabled:opacity-50"
                          >
                            <Gavel className="w-5 h-5 mr-2" />{" "}
                            {isBidding ? "..." : "Bid"}
                          </Button>
                          <Button
                            size="lg"
                            onClick={handleSkip}
                            disabled={isSkipping}
                            className="bg-amber-600 hover:bg-amber-700 text-white h-14 font-bold border-2 border-amber-500 disabled:opacity-50"
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
                              lastBidTeam !== (myTeamId || user?.teamId)
                            }
                            className="h-14 font-bold disabled:opacity-50"
                          >
                            {isUndoing ? "..." : "Undo"}
                          </Button>
                        </div>
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
                <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                  {commentary.map((comment, i) => (
                    <p key={i} className="text-white/90">
                      {comment}
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
                <div className="space-y-3">
                  {teams
                    .filter((team) => presentTeamIds.includes(team.id))
                    .map((team) => (
                      <div
                        key={team.id}
                        className={`p-4 bg-[#1a2332]/60 backdrop-blur-sm rounded-lg border ${
                          team.id === myTeamId
                            ? "border-amber-500 bg-amber-500/10"
                            : "border-white/10"
                        } hover:bg-[#1a2332]/80 transition`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-3xl">{team.logo}</span>
                          <div className="flex-1">
                            <p className="font-bold text-white text-lg">
                              {team.name}
                              {team.id === myTeamId && (
                                <span className="text-amber-400 text-sm ml-2">
                                  (My Team)
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-gray-400">
                              {team.captain}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm space-y-1 text-gray-300">
                          <p className="text-amber-400 font-bold">
                            Purse: ${team.purse.toLocaleString()}
                          </p>
                          <p className="text-white">
                            Players: {team.players}/11
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/50 bg-[#0f1419]">
              <CardContent className="p-4">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-white">
                  <User className="w-5 h-5 text-amber-400" />{" "}
                  {teams.find((t) => t.id === myTeamId)?.name || "My Team"} -
                  Players
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
                              <span>🏏 {player.batsmanType}</span>
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
