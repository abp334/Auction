import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Gavel, Clock, Trophy, User, Ban } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import confetti from "canvas-confetti";
import { io, Socket } from "socket.io-client";
import { apiFetch, API_URL } from "@/lib/api";
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
  const [timeLeft, setTimeLeft] = useState(30);
  const [auctionEndTime, setAuctionEndTime] = useState<number | null>(null);
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
  const [isBidding, setIsBidding] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  // Use ref to keep teams accessible in socket handlers
  const teamsRef = useRef<Team[]>([]);
  // Use ref to prevent multiple timer triggers
  const timerTriggeredRef = useRef<boolean>(false);
  // Debounce bid requests to prevent rapid duplicates
  const bidTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const auctionEndTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Load auction by roomCode and bootstrap teams, current player
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
        // Update ref so socket handlers can access latest teams
        teamsRef.current = mappedTeams;
        // Find captain's team
        if (role === "captain" && user?.teamId) {
          const myTeam = teams.find((t: any) => t._id === user.teamId);
          if (myTeam) {
            setMyTeamId(myTeam._id);
          } else {
            // If team not found in list, still use user.teamId as fallback
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

    // Connect socket and join room
    // Socket.IO connects to backend server (not proxied API).
    // Use VITE_SERVER_URL when provided, otherwise fall back to the current page origin
    // so the hosted site connects to its own backend automatically.
    const backendUrl =
      import.meta.env.VITE_SERVER_URL ||
      (typeof window !== "undefined" && window.location.origin) ||
      "http://localhost:5001";
    // Attach access token if available so the server can authenticate socket connections.
    // We import getAccessToken dynamically to avoid circular import timing issues.
    let s: Socket | null = null;
    import("@/lib/api").then(({ getAccessToken }) => {
      const token = getAccessToken ? getAccessToken() : null;
      s = io(backendUrl, {
        withCredentials: true,
        transports: ["websocket", "polling"],
        auth: { token },
      });
      s.emit("auction:join", roomCode);
      s.on("auction:bid_update", (e: any) => {
        // Find team name from teams ref (always has latest teams)
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
        // Update auction state with current bid
        setAuction((prev: any) =>
          prev
            ? { ...prev, currentBid: { amount: e.amount, teamId: e.teamId } }
            : null
        );
        // Update last bid team
        setLastBidTeam(e.teamId);
        // Timer will be reset by server
      });
      s.on(
        "auction:presence",
        (e: {
          userId: string;
          joined: boolean;
          role?: string;
          teamId?: string | null;
        }) => {
          // Only track captains' presence by teamId
          if (!e.teamId) return;
          if (e.role !== "captain") return;
          setPresentTeamIds((prev) => {
            const exists = prev.includes(e.teamId as string);
            if (e.joined && !exists) return [...prev, e.teamId as string];
            if (!e.joined && exists)
              return prev.filter((id) => id !== e.teamId);
            return prev;
          });
        }
      );
      s.on(
        "auction:bid_undo",
        (e: {
          teamId: string;
          teamName: string;
          currentBid?: { amount: number; teamId: string };
        }) => {
          setCommentary((prev) =>
            [`${e.teamName} withdrew their bid.`, ...prev].slice(0, 10)
          );
          if (e.currentBid) {
            setCurrentPlayer((p) =>
              p ? { ...p, currentBid: e.currentBid!.amount } : null
            );
            setAuction((prev: any) =>
              prev ? { ...prev, currentBid: e.currentBid } : null
            );
            setLastBidTeam(e.currentBid.teamId);
          } else {
            // No more bids - reset to base price (1000)
            setCurrentPlayer((p) => (p ? { ...p, currentBid: 1000 } : null));
            setAuction((prev: any) =>
              prev ? { ...prev, currentBid: undefined } : null
            );
            setLastBidTeam(null);
          }
        }
      );
      s.on("auction:sale", async (e: any) => {
        // First, refresh teams to get latest data
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

          // Use team name and player name from socket event (backend sends them)
          const teamName =
            e.teamName ||
            mappedTeams.find((t) => t.id === e.teamId)?.name ||
            `Team ${e.teamId?.substring(0, 6) || "Unknown"}`;
          const playerName = e.playerName || currentPlayer?.name || "Player";

          setCommentary((prev) =>
            [
              `${playerName} goes to ${teamName} for $${e.price.toLocaleString()}`,
              ...prev,
            ].slice(0, 10)
          );
        } else {
          // Fallback if teams fetch fails
          const team = teamsRef.current.find((t) => t.id === e.teamId);
          const teamName =
            e.teamName ||
            team?.name ||
            `Team ${e.teamId?.substring(0, 6) || "Unknown"}`;
          const playerName = e.playerName || currentPlayer?.name || "Player";
          setCommentary((prev) =>
            [
              `${playerName} goes to ${teamName} for $${e.price.toLocaleString()}`,
              ...prev,
            ].slice(0, 10)
          );
        }

        // Refresh purchased players if it's my team
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
      });
      s!.on("auction:player_changed", (e: any) => {
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
        const targetEnd =
          typeof e.remainingTime === "number"
            ? Date.now() + e.remainingTime * 1000
            : typeof e.timerEndTime === "number"
            ? e.timerEndTime
            : null;
        auctionEndTimeRef.current = targetEnd;
        setAuctionEndTime(targetEnd);
        setTimeLeft(
          targetEnd
            ? Math.max(0, Math.floor((targetEnd - Date.now()) / 1000))
            : 0
        );
        setHasSkipped(false); // Reset skip state for new player
        // Clear auction currentBid when new player is set
        setAuction((prev: any) =>
          prev ? { ...prev, currentBid: undefined } : null
        );
      });
      s!.on("auction:skip", (e: { teamId: string; teamName: string }) => {
        setCommentary((prev) =>
          [`${e.teamName} skipped this player.`, ...prev].slice(0, 10)
        );
        // If it's my team, mark as skipped
        if (e.teamId === myTeamId || e.teamId === user?.teamId) {
          setHasSkipped(true);
        }
      });
      s!.on("auction:unsold", (e: { playerId: string; playerName: string }) => {
        setCommentary((prev) =>
          [`${e.playerName} went unsold.`, ...prev].slice(0, 10)
        );
      });
      s!.on("auction:completed", (e: any) => {
        setCommentary((prev) =>
          [e.message || "Auction completed!", ...prev].slice(0, 10)
        );
        setCurrentPlayer(null);
        // Update auction state to completed
        setAuction((prev: any) =>
          prev ? { ...prev, state: "completed" } : null
        );
        toast({
          title: "Auction Completed",
          description: "All players have been sold!",
        });
      });
      s!.on("auction:ended", (e: { message: string; auctionId: string }) => {
        setCommentary((prev) =>
          [e.message || "Auction ended by admin", ...prev].slice(0, 10)
        );
        setCurrentPlayer(null);
        setAuction((prev: any) =>
          prev ? { ...prev, state: "completed" } : null
        );
        toast({
          title: "Auction Ended",
          description: "The auction has been ended by admin. Redirecting...",
          variant: "destructive",
        });
        // Redirect to joining page after 2 seconds
        setTimeout(() => {
          onExit();
        }, 2000);
      });
      setSocket(s!);
    });

    return () => {
      if (s) {
        s.emit("auction:leave", roomCode);
        s.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, role, user, myTeamId]);

  // Update ref whenever teams change
  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  // Keep end time ref in sync for interval reads
  useEffect(() => {
    auctionEndTimeRef.current = auctionEndTime;
  }, [auctionEndTime]);

  // Listen to server timer broadcasts using absolute target timestamps
  useEffect(() => {
    if (!socket) return;

    const handleTimer = (e: {
      endTime?: number;
      remainingTime?: number;
      totalTime?: number;
    }) => {
      const targetEnd = e.endTime
        ? e.endTime
        : typeof e.remainingTime === "number"
        ? Date.now() + e.remainingTime * 1000
        : null;
      auctionEndTimeRef.current = targetEnd;
      setAuctionEndTime(targetEnd);
    };

    socket.on("auction:timer", handleTimer);
    socket.on("auction:sync", handleTimer);

    return () => {
      socket.off("auction:timer", handleTimer);
      socket.off("auction:sync", handleTimer);
    };
  }, [socket]);

  // Local high-frequency countdown derived from target timestamp
  useEffect(() => {
    if (!auctionEndTimeRef.current) {
      setTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const target = auctionEndTimeRef.current;
      if (!target) {
        setTimeLeft(0);
        return;
      }
      const seconds = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setTimeLeft(seconds);
      if (seconds === 0) {
        auctionEndTimeRef.current = null;
        setAuctionEndTime(null);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [auctionEndTime]);

  const handleBid = async () => {
    // Use user.teamId as fallback if myTeamId is not set
    const teamId = myTeamId || user?.teamId;
    if (!auctionId || !currentPlayer || !teamId) {
      toast({
        title: "Error",
        description: "Cannot bid: missing auction or team",
        variant: "destructive",
      });
      return;
    }

    // Prevent multiple simultaneous bids
    if (isBidding) return;

    // Debounce rapid clicks (prevent duplicate bids)
    if (bidTimeoutRef.current) {
      return; // Already processing a bid
    }

    setIsBidding(true);
    bidTimeoutRef.current = setTimeout(() => {
      bidTimeoutRef.current = null;
    }, 1000); // 1 second debounce

    const newBid = Math.max(1000, (currentPlayer.currentBid || 1000) + 1000);

    // Optimistic UI update - update immediately before server confirms
    const optimisticBid = newBid;
    const optimisticTeamId = teamId;
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

    // Update commentary optimistically
    const teamName =
      teamsRef.current.find((t) => t.id === optimisticTeamId)?.name ||
      "Your team";
    setCommentary((prev) =>
      [`Bid: $${optimisticBid.toLocaleString()} by ${teamName}`, ...prev].slice(
        0,
        10
      )
    );

    try {
      // Emit bid over socket for low-latency path; fallback to HTTP if socket unavailable
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
        const res = await apiFetch(`/auctions/${auctionId}/bid`, {
          method: "POST",
          body: JSON.stringify({
            amount: newBid,
            teamId: teamId,
            playerId: currentPlayer.id,
          }),
        });
        if (!res.ok) {
          // Revert optimistic update on error
          const { error } = await res
            .json()
            .catch(() => ({ error: "Bid failed" }));

          // Revert to previous bid
          const previousBid =
            auction?.currentBid?.amount ||
            currentPlayer.currentBid - 1000 ||
            1000;
          setCurrentPlayer((p) =>
            p ? { ...p, currentBid: previousBid } : null
          );
          setAuction((prev: any) =>
            prev ? { ...prev, currentBid: auction?.currentBid } : null
          );

          toast({
            title: "Bid failed",
            description: error,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Bid Placed",
            description: `$${newBid.toLocaleString()}`,
          });
        }
      }
    } catch (err) {
      // Revert optimistic update on error
      const previousBid =
        auction?.currentBid?.amount || currentPlayer.currentBid - 1000 || 1000;
      setCurrentPlayer((p) => (p ? { ...p, currentBid: previousBid } : null));
      setAuction((prev: any) =>
        prev ? { ...prev, currentBid: auction?.currentBid } : null
      );

      toast({
        title: "Bid failed",
        description: "Network error. Please try again.",
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
    if (!auctionId) return;
    if (isSkipping) return; // Prevent multiple simultaneous skips
    setIsSkipping(true);

    // Optimistic UI update
    setHasSkipped(true);
    const teamName =
      teamsRef.current.find((t) => t.id === myTeamId || t.id === user?.teamId)
        ?.name || "Your team";
    setCommentary((prev) =>
      [`${teamName} skipped this player.`, ...prev].slice(0, 10)
    );

    try {
      const res = await apiFetch(`/auctions/${auctionId}/skip`, {
        method: "POST",
      });
      if (res.ok) {
        toast({
          title: "Player Skipped",
          description: "You've opted out of this player",
        });
      } else {
        // Revert optimistic update on error
        setHasSkipped(false);
        const data = await res.json();
        toast({
          title: "Error",
          description: data.error || "Failed to skip player",
          variant: "destructive",
        });
      }
    } catch (err) {
      // Revert optimistic update on error
      setHasSkipped(false);
      console.error("Failed to skip player:", err);
      toast({
        title: "Error",
        description: "Failed to skip player",
        variant: "destructive",
      });
    } finally {
      setIsSkipping(false);
    }
  };

  const handleUndo = async () => {
    if (!auctionId) return;
    if (isUndoing) return; // Prevent multiple simultaneous undos
    setIsUndoing(true);

    // Check if last bid is from my team
    const teamId = myTeamId || user?.teamId;
    if (!teamId || lastBidTeam !== teamId) {
      toast({
        title: "Cannot Undo",
        description: "You can only undo your own bids",
        variant: "destructive",
      });
      setIsUndoing(false);
      return;
    }

    // Optimistic UI update - revert to previous bid
    const previousBid = Math.max(
      1000,
      (currentPlayer?.currentBid || 1000) - 1000
    );
    const previousBidState = auction?.currentBid;
    setCurrentPlayer((p) => (p ? { ...p, currentBid: previousBid } : null));
    setAuction((prev: any) =>
      prev ? { ...prev, currentBid: previousBidState } : null
    );
    setLastBidTeam(null);

    try {
      const res = await apiFetch(`/auctions/${auctionId}/undo-bid`, {
        method: "POST",
      });
      if (res.ok) {
        toast({
          title: "Bid Undone",
          description: "Your last bid was withdrawn",
        });
      } else {
        // Revert optimistic update on error
        setCurrentPlayer((p) =>
          p ? { ...p, currentBid: currentPlayer?.currentBid || 1000 } : null
        );
        setAuction((prev: any) =>
          prev ? { ...prev, currentBid: auction?.currentBid } : null
        );
        setLastBidTeam(teamId);

        const data = await res.json();
        toast({
          title: "Error",
          description: data.error || "Failed to undo bid",
          variant: "destructive",
        });
      }
    } catch (err) {
      // Revert optimistic update on error
      setCurrentPlayer((p) =>
        p ? { ...p, currentBid: currentPlayer?.currentBid || 1000 } : null
      );
      setAuction((prev: any) =>
        prev ? { ...prev, currentBid: auction?.currentBid } : null
      );
      setLastBidTeam(teamId);

      console.error("Failed to undo bid:", err);
      toast({
        title: "Error",
        description: "Failed to undo bid",
        variant: "destructive",
      });
    } finally {
      setIsUndoing(false);
    }
  };

  const handlePlayerSold = async () => {
    // Trigger sell-current via API (admin would call this in real flow)
    if (auctionId) {
      await apiFetch(`/auctions/${auctionId}/sell-current`, { method: "POST" });
    }
    const winningTeam =
      teams[Math.floor(Math.random() * teams.length)] ||
      ({ name: "Team" } as any);

    setShowCelebration(true);
    setHasSkipped(false);

    // Confetti animation
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);

    setCommentary((prev) => [
      `🎉 ${currentPlayer?.name || "Player"} SOLD to ${
        winningTeam.name
      } for $${(currentPlayer?.currentBid || 0).toLocaleString()}!`,
      ...prev.slice(0, 4),
    ]);

    toast({
      title: "Player Sold!",
      description: `${currentPlayer?.name || "Player"} goes to ${
        winningTeam.name
      }`,
    });

    setTimeout(() => {
      setShowCelebration(false);
      // Clear current player (admin will set next via API)
      setCurrentPlayer(null);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#0f1419] text-white">
      {/* Header */}
      <header className="border-b border-amber-500/30 bg-[#0f1419]/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="secondary" size="sm" onClick={onExit}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit
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

      {/* Main Auction Area */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr,350px] gap-6">
          {/* Center - Player Card */}
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
                            All players have been sold!
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
                          <p className="text-white/70 text-lg">
                            The system is automatically selecting the next
                            player...
                          </p>
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
                        Waiting for other teams to bid...
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
                            className="bg-green-600 hover:bg-green-700 text-white text-lg h-14 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Gavel className="w-5 h-5 mr-2" />
                            {isBidding ? "Placing..." : "Bid"}
                          </Button>
                          <Button
                            size="lg"
                            onClick={handleSkip}
                            disabled={isSkipping}
                            className="bg-amber-600 hover:bg-amber-700 text-white h-14 font-bold border-2 border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSkipping ? "Skipping..." : "Skip"}
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
                            className="h-14 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isUndoing ? "Undoing..." : "Undo"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Commentary */}
            <Card className="border-amber-500/50 bg-[#0f1419]">
              <CardContent className="p-4">
                <h3 className="font-bold mb-2 flex items-center gap-2 text-white">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Live Commentary
                </h3>
                <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                  {commentary.map((comment, i) => (
                    <p key={i} className="text-white/90 slide-in">
                      {comment}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar - Teams */}
          <div className="space-y-4">
            <Card className="border-amber-500/50 bg-[#0f1419]">
              <CardContent className="p-4">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-white">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Teams
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
                  <User className="w-5 h-5 text-amber-400" />
                  {teams.find((t) => t.id === myTeamId)?.name || "My Team"} -
                  Purchased Players
                </h3>
                {myTeamPlayers.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">No players purchased yet</p>
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
