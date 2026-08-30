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

const CSV_PREVIEW_LIMIT = 8;

function buildCommentaryLines(
  orderedPlayers: StaticAuctionDetail["players"],
  saleByPlayer: Map<string, StaticAuctionDetail["sales"][number]>,
  unsoldSet: Set<string>,
  currentPlayerName?: string | null
): string[] {
  const lines: string[] = [];
  for (const ap of orderedPlayers) {
    const p = ap.player;
    const sale = saleByPlayer.get(p.id);
    if (sale) {
      lines.push(
        `SOLD · ${p.name} → ${sale.team.name} for ${formatINR(sale.price)}`
      );
    } else if (p.isUnsold || unsoldSet.has(p.id)) {
      lines.push(`UNSOLD · ${p.name}`);
    }
  }
  if (lines.length === 0) {
    return currentPlayerName
      ? [`Now auctioning: ${currentPlayerName}`]
      : ["Ledger ready — record each sale from the floor."];
  }
  return lines.reverse();
}

const StaticAuctionTab = () => {
  const { toast } = useToast();
  const [auctionName, setAuctionName] = useState("");
  const [maxSquadSize, setMaxSquadSize] = useState("25");
  const [teamsData, setTeamsData] = useState<StagedTeam[]>([]);
  const [playersData, setPlayersData] = useState<StagedPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [auction, setAuction] = useState<AuctionDetail | null>(null);

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [amount, setAmount] = useState("");
  const [showTeamsDialog, setShowTeamsDialog] = useState(false);
  const [showQueue, setShowQueue] = useState(true);
  /** Tracks the most recently sold/unsold player for Undo Last. */
  const [lastActionPlayerId, setLastActionPlayerId] = useState<string | null>(
    null
  );

  const loadAuction = useCallback(async (id: string) => {
    const boardRes = await apiFetch(`/auctions/${id}/static-board`);
    if (boardRes.ok) {
      const data = await boardRes.json();
      return data.auction as AuctionDetail;
    }

    // Fallback for servers not yet deployed with /static-board
    if (boardRes.status === 404) {
      const res = await apiFetch(`/auctions/${id}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.auction as AuctionDetail;
    }

    return null;
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

  const undoTarget = useMemo(() => {
    const resolve = (playerId: string) => {
      const row = orderedPlayers.find((ap) => ap.player.id === playerId);
      if (!row) return null;
      const p = row.player;
      const sale = saleByPlayer.get(playerId);
      const isUnsold = p.isUnsold || unsoldSet.has(playerId);
      if (sale) {
        return {
          playerId,
          name: p.name,
          kind: "sale" as const,
          detail: `${sale.team.name} · ${formatINR(sale.price)}`,
        };
      }
      if (isUnsold) {
        return { playerId, name: p.name, kind: "unsold" as const, detail: "" };
      }
      return null;
    };

    if (lastActionPlayerId) {
      const recent = resolve(lastActionPlayerId);
      if (recent) return recent;
    }

    for (let i = orderedPlayers.length - 1; i >= 0; i--) {
      const hit = resolve(orderedPlayers[i].player.id);
      if (hit) return hit;
    }
    return null;
  }, [lastActionPlayerId, orderedPlayers, saleByPlayer, unsoldSet]);

  const commentary = useMemo(
    () =>
      buildCommentaryLines(
        orderedPlayers,
        saleByPlayer,
        unsoldSet,
        currentPlayer?.name
      ),
    [orderedPlayers, saleByPlayer, unsoldSet, currentPlayer?.name]
  );

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
    setLoadingMessage(
      `Importing ${playersData.length} players and ${teamsData.length} teams…`
    );
    try {
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Create failed",
          description: err.error || "Could not create static auction.",
          variant: "destructive",
        });
        return;
      }
      setLoadingMessage("Loading auction board…");
      const data = await res.json();
      const full = await loadAuction(data.auction.id);
      if (full) {
        setAuction(full);
        setTeamsData([]);
        setPlayersData([]);
        setAuctionName("");
        toast({ title: "Ledger ready", description: data.message });
      } else {
        toast({
          title: "Ledger created but could not load",
          description:
            "Refresh the page. If it persists, redeploy the backend on Render.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
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
    setLastActionPlayerId(currentPlayer.id);
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
    setLastActionPlayerId(currentPlayer.id);
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

  const undoPlayer = async (playerId: string) => {
    if (!auction) return;
    const sale = saleByPlayer.get(playerId);
    const row = orderedPlayers.find((ap) => ap.player.id === playerId);
    const isUnsold =
      row &&
      (row.player.isUnsold || unsoldSet.has(playerId));
    if (sale) await undoSale(playerId);
    else if (isUnsold) await undoUnsold(playerId);
    else {
      toast({
        title: "Nothing to undo",
        description: "This player has no sale or unsold record.",
        variant: "destructive",
      });
      return;
    }
    setLastActionPlayerId((prev) => (prev === playerId ? null : prev));
  };

  const handleUndoLast = async () => {
    if (!undoTarget) {
      toast({
        title: "Nothing to undo",
        description: "Record a sale or unsold first.",
        variant: "destructive",
      });
      return;
    }
    await undoPlayer(undoTarget.playerId);
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
                {teamsData.slice(0, CSV_PREVIEW_LIMIT).map((t, i) => (
                  <li key={`${t.name}-${i}`}>
                    {t.name} · {formatINR(t.wallet)}
                  </li>
                ))}
                {teamsData.length > CSV_PREVIEW_LIMIT && (
                  <li className="text-gray-500 italic">
                    … and {teamsData.length - CSV_PREVIEW_LIMIT} more teams
                  </li>
                )}
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
                {playersData.slice(0, CSV_PREVIEW_LIMIT).map((p, i) => (
                  <li key={`${p.name}-${i}`}>
                    {i + 1}. {p.name} · {p.role} · {formatINR(p.basePrice)}
                  </li>
                ))}
                {playersData.length > CSV_PREVIEW_LIMIT && (
                  <li className="text-gray-500 italic">
                    … and {playersData.length - CSV_PREVIEW_LIMIT} more players
                  </li>
                )}
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
            {loading
              ? loadingMessage || "Creating…"
              : "Start ledger"}
          </Button>
          {loading && playersData.length > 50 && (
            <p className="text-xs text-gray-400">
              Large imports can take 1–2 minutes on the server — please wait.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const currentPlayerSale = currentPlayer
    ? saleByPlayer.get(currentPlayer.id)
    : undefined;

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col">
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
      undoTarget={undoTarget}
      commentary={commentary}
      onUndoLast={handleUndoLast}
      onUndoPlayer={undoPlayer}
      onSetCurrent={setCurrent}
      onExport={exportReport}
      onComplete={completeAuction}
      onReopen={reopenAuction}
      onStartFresh={startFresh}
      onShowTeamsDialog={setShowTeamsDialog}
      onShowQueue={setShowQueue}
      />
    </div>
  );
};

export default StaticAuctionTab;
