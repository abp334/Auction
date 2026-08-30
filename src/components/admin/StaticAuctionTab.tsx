import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, ClipboardList } from "lucide-react";
import { apiFetch } from "@/lib/api";
import StaticBidderBoard from "@/components/admin/StaticBidderBoard";
import { parseCSV, jsonToCSV } from "@/lib/utils";
import {
  downloadAuctionCSV,
  downloadAuctionPDF,
  formatINR,
} from "@/lib/auction-report";
import {
  patchAfterSale,
  patchAfterUndoSale,
  patchAfterUndoUnsold,
  patchAfterUnsold,
  patchAuctionState,
  patchCurrentPlayer,
  type StaticAuctionDetail,
} from "@/lib/static-auction-patch";

type AuctionDetail = StaticAuctionDetail;

type StagedTeam = {
  name: string;
  wallet: number;
  owner?: string;
  logo?: string;
  captain?: string;
  captainEmail?: string;
};

type StagedPlayer = {
  name: string;
  role: string;
  basePrice: number;
  age?: number;
  photo?: string;
  batsmanType?: string;
  bowlerType?: string;
  mobile?: string;
  email?: string;
};

const StaticAuctionTab = () => {
  const { toast } = useToast();
  const [auctionName, setAuctionName] = useState("");
  const [maxSquadSize, setMaxSquadSize] = useState("25");
  const [teamsData, setTeamsData] = useState<StagedTeam[]>([]);
  const [playersData, setPlayersData] = useState<StagedPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [auction, setAuction] = useState<AuctionDetail | null>(null);

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [amount, setAmount] = useState("");
  const [showTeamsDialog, setShowTeamsDialog] = useState(false);
  const [showQueue, setShowQueue] = useState(true);

  const loadAuction = useCallback(async (id: string) => {
    const res = await apiFetch(`/auctions/${id}/static-board`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.auction as AuctionDetail;
  }, []);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/auctions");
      if (!res.ok) return;
      const { auctions } = await res.json();
      const staticOnes = (auctions || []).filter((a: any) => a.mode === "static");
      // Prefer an in-progress ledger; never trap admin on a completed one.
      const preferred =
        staticOnes.find((a: any) => a.state === "active") ||
        staticOnes.find((a: any) => a.state === "draft") ||
        null;
      if (preferred) {
        const full = await loadAuction(preferred.id);
        if (full) setAuction(full);
      }
    })();
  }, [loadAuction]);

  const unsoldSet = useMemo(
    () => new Set(auction?.unsoldPlayers?.map((u) => u.playerId) || []),
    [auction]
  );

  const saleByPlayer = useMemo(() => {
    const map = new Map<string, AuctionDetail["sales"][number]>();
    auction?.sales?.forEach((s) => map.set(s.playerId, s));
    return map;
  }, [auction]);

  const rosterByTeam = useMemo(() => {
    const map = new Map<string, AuctionDetail["sales"]>();
    auction?.sales?.forEach((s) => {
      const list = map.get(s.teamId) || [];
      list.push(s);
      map.set(s.teamId, list);
    });
    return map;
  }, [auction]);

  const summary = useMemo(() => {
    if (!auction) {
      return { sold: 0, unsold: 0, pending: 0, total: 0, spent: 0, highest: null as null | AuctionDetail["sales"][number] };
    }
    const sold = auction.sales.length;
    const unsold = auction.unsoldPlayers.length;
    const total = auction.players.length;
    const pending = Math.max(0, total - sold - unsold);
    const spent = auction.sales.reduce((s, x) => s + x.price, 0);
    const highest =
      auction.sales.length > 0
        ? auction.sales.reduce((max, s) => (s.price > max.price ? s : max))
        : null;
    return { sold, unsold, pending, total, spent, highest };
  }, [auction]);

  const maxTeamSpent = useMemo(() => {
    let max = 1;
    rosterByTeam.forEach((list) => {
      const spent = list.reduce((s, x) => s + x.price, 0);
      if (spent > max) max = spent;
    });
    return max;
  }, [rosterByTeam]);

  const orderedPlayers = useMemo(() => {
    if (!auction) return [];
    return [...auction.players].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [auction]);

  const currentPlayer = useMemo(() => {
    if (!auction?.currentPlayerId) return null;
    return (
      orderedPlayers.find((p) => p.player.id === auction.currentPlayerId)
        ?.player || null
    );
  }, [auction, orderedPlayers]);

  const completed = auction?.state === "completed";

  const selectedTeam = useMemo(
    () => auction?.teams.find((t) => t.team.id === selectedTeamId)?.team,
    [auction, selectedTeamId]
  );

  const amountNum = useMemo(() => {
    const n = Math.round(Number(amount));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [amount]);

  const addIncrement = (inc: number) => {
    const base =
      amountNum > 0 ? amountNum : Math.round(currentPlayer?.basePrice || 0);
    setAmount(String(base + inc));
  };

  const handleUndoCurrent = async () => {
    if (!auction || !currentPlayer) {
      toast({
        title: "Nothing to undo",
        description: "Select a player with a recorded sale or unsold status.",
        variant: "destructive",
      });
      return;
    }
    const sale = saleByPlayer.get(currentPlayer.id);
    const isUnsold =
      currentPlayer.isUnsold || unsoldSet.has(currentPlayer.id);
    if (sale) await undoSale(currentPlayer.id);
    else if (isUnsold) await undoUnsold(currentPlayer.id);
    else {
      toast({
        title: "Nothing to undo",
        description: "This player has no sale or unsold record yet.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (currentPlayer) {
      setAmount(String(currentPlayer.basePrice || 0));
    }
  }, [currentPlayer?.id]);

  const handleCsvUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "teams" | "players"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length === 0) throw new Error("Empty file");

        if (type === "teams") {
          const mapped = parsed.map((p) => ({
            name: p.name || p.team || p["team name"] || "New Team",
            wallet: Number(p.wallet || 10000000),
            owner: p.owner || "",
            logo: p.logo || "",
            captain: p.captain || p["captain name"] || "",
            captainEmail: p.email || p["captain email"] || "",
          }));
          setTeamsData((prev) => [...prev, ...mapped]);
        } else {
          const cleanNA = (value: any) => {
            const s = String(value ?? "").trim();
            return s.toUpperCase() === "N/A" ? "" : s;
          };
          const mapped = parsed.map((p) => ({
            name: p.name || "Unknown Player",
            role: String(p.role || "Batsman").trim(),
            basePrice: Number(p.baseprice || p.price || 1000),
            age: Number(p.age || 25),
            photo: p.photo || "",
            batsmanType: cleanNA(p.batsmantype || p.battingtype || p.batting),
            bowlerType:
              cleanNA(p.bowlertype || p.bowlingtype || p.bowling) || "None",
            mobile: p.mobile || "",
            email: p.email || "",
          }));
          // Preserve CSV row order exactly — do not sort
          setPlayersData((prev) => [...prev, ...mapped]);
        }
        toast({
          title: "Imported",
          description: `Loaded ${file.name}`,
        });
      } catch {
        toast({
          title: "Error",
          description: "Failed to parse CSV.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const downloadSampleCSV = (type: "teams" | "players") => {
    const sample =
      type === "teams"
        ? [
            {
              name: "Chennai Super Kings",
              captain: "MS Dhoni",
              wallet: 10000000,
              owner: "Owner",
              logo: "",
            },
            {
              name: "Mumbai Indians",
              captain: "Rohit Sharma",
              wallet: 10000000,
              owner: "Owner",
              logo: "",
            },
          ]
        : [
            {
              name: "Player One",
              role: "Batsman",
              baseprice: 1000,
              age: 25,
              batsmanType: "Right-Hand Batsman",
              bowlerType: "N/A",
            },
            {
              name: "Player Two",
              role: "Bowler",
              baseprice: 1500,
              age: 28,
              batsmanType: "N/A",
              bowlerType: "Right Arm Fast",
            },
          ];
    const blob = new Blob([jsonToCSV(sample)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sample_static_${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createLedger = async () => {
    if (!auctionName || teamsData.length < 2 || playersData.length === 0) {
      toast({
        title: "Validation",
        description: "Need a name, 2+ teams, and at least 1 player.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const res = await apiFetch("/auctions", {
      method: "POST",
      body: JSON.stringify({
        name: auctionName,
        mode: "static",
        maxSquadSize: Number(maxSquadSize) || 25,
        teams: teamsData,
        players: playersData,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Create failed",
        description: err.error || "Could not create static auction.",
        variant: "destructive",
      });
      return;
    }
    const data = await res.json();
    const full = await loadAuction(data.auction.id);
    if (full) {
      setAuction(full);
      setTeamsData([]);
      setPlayersData([]);
      setAuctionName("");
    }
    toast({ title: "Ledger ready", description: data.message });
  };

  const refresh = async () => {
    if (!auction) return;
    const full = await loadAuction(auction.id);
    if (full) setAuction(full);
  };

  const registerSale = async () => {
    if (!auction || !currentPlayer || !selectedTeamId) {
      toast({
        title: "Missing info",
        description: "Select a team and ensure a current player is set.",
        variant: "destructive",
      });
      return;
    }
    const amt = Math.round(Number(amount));
    if (!Number.isFinite(amt) || amt < 0 || !Number.isInteger(amt)) {
      toast({
        title: "Invalid amount",
        description: "Enter a whole-number sale amount.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const res = await apiFetch(`/auctions/${auction.id}/register-sale`, {
      method: "POST",
      body: JSON.stringify({
        playerId: currentPlayer.id,
        teamId: selectedTeamId,
        amount: amt,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Sale rejected",
        description: err.error || "Could not register sale.",
        variant: "destructive",
      });
      return;
    }
    const data = await res.json();
    setAuction((prev) => (prev ? patchAfterSale(prev, data) : prev));
    toast({
      title: "Sold",
      description: `${currentPlayer.name} sold for ${formatINR(amt)}`,
    });
    setSelectedTeamId("");
  };

  const registerUnsold = async () => {
    if (!auction || !currentPlayer) return;
    setLoading(true);
    const res = await apiFetch(`/auctions/${auction.id}/register-unsold`, {
      method: "POST",
      body: JSON.stringify({ playerId: currentPlayer.id }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Failed",
        description: err.error || "Could not mark unsold.",
        variant: "destructive",
      });
      return;
    }
    const data = await res.json();
    setAuction((prev) => (prev ? patchAfterUnsold(prev, data) : prev));
    toast({ title: "Unsold", description: `${currentPlayer.name} marked unsold` });
  };

  const undoSale = async (playerId: string) => {
    if (!auction) return;
    setLoading(true);
    const res = await apiFetch(`/auctions/${auction.id}/sales/${playerId}`, {
      method: "DELETE",
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Undo failed",
        description: err.error || "Could not undo sale.",
        variant: "destructive",
      });
      return;
    }
    const data = await res.json();
    setAuction((prev) => (prev ? patchAfterUndoSale(prev, data) : prev));
    toast({ title: "Sale undone", description: "Purse restored." });
  };

  const undoUnsold = async (playerId: string) => {
    if (!auction) return;
    setLoading(true);
    const res = await apiFetch(`/auctions/${auction.id}/unsold/${playerId}`, {
      method: "DELETE",
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Undo failed",
        description: err.error || "Could not undo unsold.",
        variant: "destructive",
      });
      return;
    }
    const data = await res.json();
    setAuction((prev) => (prev ? patchAfterUndoUnsold(prev, data) : prev));
    toast({ title: "Unsold undone" });
  };

  const setCurrent = async (playerId: string) => {
    if (!auction || completed) return;
    const res = await apiFetch(`/auctions/${auction.id}/static-current`, {
      method: "POST",
      body: JSON.stringify({ playerId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Could not switch player",
        description: err.error || "Try again.",
        variant: "destructive",
      });
      return;
    }
    const data = await res.json();
    setAuction((prev) =>
      prev ? patchCurrentPlayer(prev, data.currentPlayerId, data.player) : prev
    );
  };

  const completeAuction = async () => {
    if (!auction) return;
    setLoading(true);
    const res = await apiFetch(`/auctions/${auction.id}/complete`, {
      method: "POST",
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Failed",
        description: err.error || "Could not complete.",
        variant: "destructive",
      });
      return;
    }
    setAuction((prev) =>
      prev ? patchAuctionState(prev, "completed", null) : prev
    );
    toast({ title: "Completed", description: "Ledger locked. Export still available. You can reopen or start a new one." });
  };

  const reopenAuction = async () => {
    if (!auction) return;
    setLoading(true);
    const res = await apiFetch(`/auctions/${auction.id}/reopen`, {
      method: "POST",
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Failed",
        description: err.error || "Could not reopen.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Reopened", description: "You can edit sales again." });
    await refresh();
  };

  const startFresh = async () => {
    if (!auction) {
      setAuction(null);
      return;
    }
    if (auction.state !== "completed") {
      toast({
        title: "Export & complete first",
        description: "Complete the current ledger (or delete it) before starting a new one.",
        variant: "destructive",
      });
      return;
    }
    const ok = window.confirm(
      "Delete this completed ledger from the server after you've exported? This cannot be undone."
    );
    if (!ok) {
      // Keep data; just go to setup for a parallel new auction
      setAuction(null);
      return;
    }
    setLoading(true);
    const res = await apiFetch(`/auctions/${auction.id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      toast({
        title: "Delete failed",
        description: err.error || "Could not delete ledger.",
        variant: "destructive",
      });
      return;
    }
    setAuction(null);
    setTeamsData([]);
    setPlayersData([]);
    toast({ title: "Ready", description: "Upload a new CSV to start a fresh ledger." });
  };

  const exportReport = async (as: "csv" | "pdf") => {
    if (!auction) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/auctions/${auction.id}/report`);
      if (!res.ok) {
        toast({
          title: "Export failed",
          description: "Could not fetch report.",
          variant: "destructive",
        });
        return;
      }
      const { report } = await res.json();
      if (as === "csv") {
        downloadAuctionCSV(report, auction.name);
        toast({ title: "CSV downloaded", description: "Players + teams exported." });
      } else {
        downloadAuctionPDF(report, auction.name, {
          subtitle: "STATIC LEDGER REPORT",
        });
        toast({
          title: "PDF downloaded",
          description: "Full report with rosters and charts.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Setup screen ---
  if (!auction) {
    return (
      <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-white">Single Bidder Mode</CardTitle>
          </div>
          <CardDescription className="text-gray-400">
            Upload teams and players in CSV order, then record each sale on
            behalf of all teams. No multiplayer, no timers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-gray-300">Auction name</Label>
              <Input
                value={auctionName}
                onChange={(e) => setAuctionName(e.target.value)}
                placeholder="IPL Season Auction"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-300">Max squad size</Label>
              <Input
                type="number"
                value={maxSquadSize}
                onChange={(e) => setMaxSquadSize(e.target.value)}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-white/10 bg-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-white">Teams ({teamsData.length})</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadSampleCSV("teams")}
                  className="text-gray-400"
                >
                  <Download className="w-4 h-4 mr-1" /> Sample
                </Button>
              </div>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => handleCsvUpload(e, "teams")}
                className="bg-white/10 border-white/20 text-white file:text-white"
              />
              <ul className="text-sm text-gray-400 max-h-32 overflow-y-auto space-y-1">
                {teamsData.map((t, i) => (
                  <li key={`${t.name}-${i}`}>
                    {t.name} · {formatINR(t.wallet)}
                  </li>
                ))}
              </ul>
              {teamsData.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400"
                  onClick={() => setTeamsData([])}
                >
                  Clear teams
                </Button>
              )}
            </div>

            <div className="p-4 rounded-lg border border-white/10 bg-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-white">
                  Players ({playersData.length}) — CSV order kept
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadSampleCSV("players")}
                  className="text-gray-400"
                >
                  <Download className="w-4 h-4 mr-1" /> Sample
                </Button>
              </div>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => handleCsvUpload(e, "players")}
                className="bg-white/10 border-white/20 text-white file:text-white"
              />
              <ul className="text-sm text-gray-400 max-h-32 overflow-y-auto space-y-1">
                {playersData.map((p, i) => (
                  <li key={`${p.name}-${i}`}>
                    {i + 1}. {p.name} · {p.role} · {formatINR(p.basePrice)}
                  </li>
                ))}
              </ul>
              {playersData.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400"
                  onClick={() => setPlayersData([])}
                >
                  Clear players
                </Button>
              )}
            </div>
          </div>

          <Button
            onClick={createLedger}
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {loading ? "Creating…" : "Start ledger"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentPlayerSale = currentPlayer
    ? saleByPlayer.get(currentPlayer.id)
    : undefined;

  return (
    <StaticBidderBoard
      auctionName={auction.name}
      completed={completed}
      loading={loading}
      summary={summary}
      currentPlayer={currentPlayer}
      amount={amount}
      amountNum={amountNum}
      selectedTeamId={selectedTeamId}
      selectedTeamName={selectedTeam?.name}
      currentPlayerSale={currentPlayerSale}
      teams={auction.teams}
      maxSquadSize={auction.maxSquadSize}
      rosterByTeam={rosterByTeam}
      maxTeamSpent={maxTeamSpent}
      orderedPlayers={orderedPlayers}
      saleByPlayer={saleByPlayer}
      unsoldSet={unsoldSet}
      currentPlayerId={auction.currentPlayerId}
      showTeamsDialog={showTeamsDialog}
      showQueue={showQueue}
      onAmountChange={setAmount}
      onAddIncrement={addIncrement}
      onSelectTeam={setSelectedTeamId}
      onRegisterSale={registerSale}
      onRegisterUnsold={registerUnsold}
      onUndoCurrent={handleUndoCurrent}
      onSetCurrent={setCurrent}
      onExport={exportReport}
      onComplete={completeAuction}
      onReopen={reopenAuction}
      onStartFresh={startFresh}
      onShowTeamsDialog={setShowTeamsDialog}
      onShowQueue={setShowQueue}
    />
  );
};

export default StaticAuctionTab;
