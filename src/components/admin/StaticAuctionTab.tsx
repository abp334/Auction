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
import {
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Undo2,
  ClipboardList,
  Trophy,
  Users,
  Wallet,
  TrendingUp,
  FileText,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { parseCSV, jsonToCSV } from "@/lib/utils";
import {
  downloadAuctionCSV,
  downloadAuctionPDF,
  formatINR,
} from "@/lib/auction-report";

const TEAM_ACCENTS = [
  "border-amber-500/40 bg-amber-500/10",
  "border-sky-500/40 bg-sky-500/10",
  "border-emerald-500/40 bg-emerald-500/10",
  "border-violet-500/40 bg-violet-500/10",
  "border-pink-500/40 bg-pink-500/10",
  "border-teal-500/40 bg-teal-500/10",
];

const TEAM_BAR = [
  "bg-amber-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-pink-500",
  "bg-teal-500",
];

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

type AuctionDetail = {
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

  const loadAuction = useCallback(async (id: string) => {
    const res = await apiFetch(`/auctions/${id}`);
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
    toast({
      title: "Sold",
      description: `${currentPlayer.name} sold for ${formatINR(amt)}`,
    });
    setSelectedTeamId("");
    await refresh();
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
    toast({ title: "Unsold", description: `${currentPlayer.name} marked unsold` });
    await refresh();
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
    toast({ title: "Sale undone", description: "Purse restored." });
    await refresh();
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
    toast({ title: "Unsold undone" });
    await refresh();
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
    await refresh();
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
    toast({ title: "Completed", description: "Ledger locked. Export still available. You can reopen or start a new one." });
    await refresh();
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
            <CardTitle className="text-white">Static Auction Ledger</CardTitle>
          </div>
          <CardDescription className="text-gray-400">
            Single-admin companion for a physical auction. Upload teams and
            players in CSV order, then register each sale. No multiplayer, no
            timers.
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

  // --- Session board ---
  const progressPct =
    summary.total > 0
      ? Math.round(((summary.sold + summary.unsold) / summary.total) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl overflow-hidden border border-white/10">
        <div className="bg-[#0f1419] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl font-bold text-white">{auction.name}</h2>
            </div>
            <p className="text-sm text-amber-400/90 mt-1 tracking-wide uppercase">
              Static ledger report · {completed ? "Completed" : "Live floor companion"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportReport("csv")}
              disabled={loading}
              className="bg-white/10 text-white border-white/20"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportReport("pdf")}
              disabled={loading}
              className="bg-white/10 text-white border-white/20"
            >
              <FileText className="w-4 h-4 mr-1" /> PDF
            </Button>
            {!completed ? (
              <Button
                size="sm"
                onClick={completeAuction}
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                Complete
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={reopenAuction}
                  disabled={loading}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black"
                >
                  Reopen
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={startFresh}
                  disabled={loading}
                  className="bg-white/10 text-white border-white/20"
                >
                  New ledger
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="h-1 bg-amber-500" />

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-[#1a2332]/80">
          {[
            {
              label: "Sold",
              value: String(summary.sold),
              icon: CheckCircle2,
              color: "text-emerald-400",
            },
            {
              label: "Unsold",
              value: String(summary.unsold),
              icon: XCircle,
              color: "text-red-400",
            },
            {
              label: "Pending",
              value: String(summary.pending),
              icon: Users,
              color: "text-sky-400",
            },
            {
              label: "Total spent",
              value: formatINR(summary.spent),
              icon: Wallet,
              color: "text-amber-400",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg bg-[#0f1419]/80 border border-white/10 px-3 py-3"
            >
              <div className="flex items-center gap-1.5 text-xs text-gray-400 uppercase tracking-wide">
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                {s.label}
              </div>
              <div className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Progress + highest */}
        <div className="px-4 pb-4 bg-[#1a2332]/80 space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Auction progress</span>
            <span>
              {summary.sold + summary.unsold}/{summary.total} · {progressPct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${summary.total ? (summary.sold / summary.total) * 100 : 0}%`,
              }}
            />
            <div
              className="h-full bg-red-500/80 transition-all"
              style={{
                width: `${summary.total ? (summary.unsold / summary.total) * 100 : 0}%`,
              }}
            />
          </div>
          {summary.highest && (
            <p className="text-sm text-gray-300 flex items-center gap-2 pt-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Highest sale:{" "}
              <span className="text-white font-semibold">
                {summary.highest.player.name}
              </span>{" "}
              → {summary.highest.team.name} for{" "}
              <span className="text-amber-400 font-semibold">
                {formatINR(summary.highest.price)}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Current player */}
        <Card className="lg:col-span-3 border-amber-500/20 bg-[#1a2332]/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Current player
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentPlayer ? (
              <>
                <div className="flex gap-4 items-start p-4 rounded-xl bg-[#0f1419]/70 border border-white/10">
                  {currentPlayer.photo ? (
                    <img
                      src={currentPlayer.photo}
                      alt=""
                      className="w-24 h-24 rounded-xl object-cover ring-2 ring-amber-500/40"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-700/20 flex items-center justify-center text-3xl font-bold text-amber-200 ring-2 ring-amber-500/40">
                      {currentPlayer.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-bold text-white truncate">
                      {currentPlayer.name}
                    </h3>
                    <p className="text-gray-400 mt-1">
                      {currentPlayer.role}
                      {currentPlayer.age ? ` · Age ${currentPlayer.age}` : ""}
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-1.5">
                      <span className="text-xs text-amber-200/80 uppercase tracking-wide">
                        Base price
                      </span>
                      <span className="text-amber-400 font-bold">
                        {formatINR(currentPlayer.basePrice)}
                      </span>
                    </div>
                  </div>
                </div>

                {!completed && (
                  <div className="grid sm:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-gray-300 text-xs">Winning team</Label>
                      <Select
                        value={selectedTeamId}
                        onValueChange={setSelectedTeamId}
                      >
                        <SelectTrigger className="bg-[#0f1419] border-white/20 text-white">
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          {auction.teams.map((at) => (
                            <SelectItem key={at.team.id} value={at.team.id}>
                              {at.team.name} ({formatINR(at.team.wallet)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-gray-300 text-xs">Hammer amount</Label>
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-[#0f1419] border-white/20 text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={registerSale}
                        disabled={loading}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Sell
                      </Button>
                      <Button
                        onClick={registerUnsold}
                        disabled={loading}
                        variant="secondary"
                        className="bg-white/10 text-white border-white/20"
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Unsold
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-400 py-6 text-center">
                {completed
                  ? "Auction completed — export PDF for full rosters & charts."
                  : "No pending players left — export or complete."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Spending chart */}
        <Card className="lg:col-span-2 border-white/10 bg-[#1a2332]/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Team spending</CardTitle>
            <CardDescription className="text-gray-400">
              Purse used vs remaining
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-72 overflow-y-auto">
            {auction.teams.map((at, i) => {
              const roster = rosterByTeam.get(at.team.id) || [];
              const spent = roster.reduce((s, x) => s + x.price, 0);
              const width = Math.max((spent / maxTeamSpent) * 100, spent > 0 ? 4 : 0);
              return (
                <div key={at.team.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white font-medium truncate pr-2">
                      {at.team.name}
                    </span>
                    <span className="text-amber-400 shrink-0">{formatINR(spent)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${TEAM_BAR[i % TEAM_BAR.length]}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {roster.length} players · purse left {formatINR(at.team.wallet)}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Team rosters */}
      <div>
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" />
          Team rosters
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {auction.teams.map((at, i) => {
            const roster = rosterByTeam.get(at.team.id) || [];
            const spent = roster.reduce((s, x) => s + x.price, 0);
            const selected = selectedTeamId === at.team.id;
            return (
              <div
                key={at.team.id}
                className={`rounded-xl border p-4 transition ${
                  selected
                    ? "border-amber-500/50 bg-amber-500/10"
                    : `${TEAM_ACCENTS[i % TEAM_ACCENTS.length]}`
                }`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  disabled={completed || !currentPlayer}
                  onClick={() => setSelectedTeamId(at.team.id)}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-white font-semibold">{at.team.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {at.team.captain ? `Captain: ${at.team.captain}` : "No captain"}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-amber-400 font-semibold">
                        {formatINR(spent)} spent
                      </div>
                      <div className="text-gray-400">
                        {formatINR(at.team.wallet)} left
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    Squad {roster.length}/{auction.maxSquadSize || 25}
                    {selected && !completed ? " · selected for sell" : ""}
                  </div>
                </button>
                <ul className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
                  {roster.length === 0 ? (
                    <li className="text-xs text-gray-500 italic">No players yet</li>
                  ) : (
                    roster.map((s) => (
                      <li
                        key={s.playerId}
                        className="flex items-center justify-between gap-2 text-sm rounded-md bg-[#0f1419]/50 px-2 py-1.5"
                      >
                        <span className="text-white truncate">
                          {s.player.name}
                          <span className="text-gray-500 text-xs ml-1">
                            {s.player.role || ""}
                          </span>
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <span className="text-emerald-400 text-xs font-semibold">
                            {formatINR(s.price)}
                          </span>
                          {!completed && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-gray-500 hover:text-white"
                              onClick={() => undoSale(s.playerId)}
                            >
                              <Undo2 className="w-3 h-3" />
                            </Button>
                          )}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player queue */}
      <Card className="border-white/10 bg-[#1a2332]/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg">
            Player queue (CSV order)
          </CardTitle>
          <CardDescription className="text-gray-400">
            Click a pending player to jump order. Undo sold/unsold anytime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {orderedPlayers.map((ap, idx) => {
              const p = ap.player;
              const sale = saleByPlayer.get(p.id);
              const isUnsold = p.isUnsold || unsoldSet.has(p.id);
              const isCurrent = auction.currentPlayerId === p.id;
              const isPending = !sale && !isUnsold;

              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border ${
                    isCurrent
                      ? "border-amber-500/50 bg-amber-500/10"
                      : sale
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : isUnsold
                          ? "border-red-500/20 bg-red-500/5"
                          : "border-transparent hover:bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 text-left min-w-0"
                    disabled={completed || !isPending}
                    onClick={() => isPending && setCurrent(p.id)}
                  >
                    <span className="text-gray-500 text-xs mr-2 tabular-nums">
                      {idx + 1}.
                    </span>
                    <span className="text-white font-medium">{p.name}</span>
                    <span className="text-gray-500 text-sm ml-2">{p.role}</span>
                    {isCurrent && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-400 font-semibold">
                        Current
                      </span>
                    )}
                    {sale && (
                      <span className="ml-2 text-xs text-emerald-300">
                        Sold → {sale.team.name} @ {formatINR(sale.price)}
                      </span>
                    )}
                    {isUnsold && !sale && (
                      <span className="ml-2 text-xs text-red-400 uppercase tracking-wide">
                        Unsold
                      </span>
                    )}
                  </button>
                  {!completed && sale && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => undoSale(p.id)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Undo2 className="w-4 h-4" />
                    </Button>
                  )}
                  {!completed && isUnsold && !sale && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => undoUnsold(p.id)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Undo2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaticAuctionTab;
