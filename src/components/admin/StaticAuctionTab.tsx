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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  teams: Array<{ team: { id: string; name: string; wallet: number; captain?: string | null; logo?: string | null } }>;
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
    player: { name: string };
    team: { name: string };
  }>;
  unsoldPlayers: Array<{ playerId: string }>;
};

const formatINR = (n: number) =>
  `₹${Number(n || 0).toLocaleString("en-IN")}`;

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

  const squadCounts = useMemo(() => {
    const map = new Map<string, number>();
    auction?.players?.forEach((ap) => {
      const tid = ap.player.teamId;
      if (tid) map.set(tid, (map.get(tid) || 0) + 1);
    });
    return map;
  }, [auction]);

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
      const rows: any[] = [];
      report.teams.forEach((t: any) => {
        (t.Roster || []).forEach((p: any) => {
          rows.push({
            Team: t.TeamName,
            Player: p.Name,
            Role: p.Role,
            SoldPrice: p.SoldPrice,
            RemainingPurse: t.RemainingPurse,
          });
        });
      });
      (report.unsold || []).forEach((p: any) => {
        rows.push({
          Team: "UNSOLD",
          Player: p.Name,
          Role: p.Role,
          SoldPrice: 0,
          RemainingPurse: "",
        });
      });
      const blob = new Blob([jsonToCSV(rows)], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Static_${(report.auctionName || "Auction").replace(/\s+/g, "_")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV downloaded" });
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(report.auctionName || "Static Auction", 14, 18);
    doc.setFontSize(10);
    doc.text(
      `Sold: ${report.summary?.totalSold ?? 0} · Unsold: ${report.summary?.totalUnsold ?? 0} · Spent: ${formatINR(report.summary?.totalSpent || 0)}`,
      14,
      26
    );
    autoTable(doc, {
      startY: 32,
      head: [["Team", "Players", "Spent", "Remaining"]],
      body: (report.teams || []).map((t: any) => [
        t.TeamName,
        String(t.PlayersCount),
        formatINR(t.TotalSpent || 0),
        formatINR(t.RemainingPurse || 0),
      ]),
    });
    doc.save(`Static_${(report.auctionName || "Auction").replace(/\s+/g, "_")}.pdf`);
    toast({ title: "PDF downloaded" });
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
  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-emerald-400" />
              {auction.name}
            </CardTitle>
            <CardDescription className="text-gray-400">
              Static ledger · {completed ? "Completed" : "In progress"} · Order =
              CSV upload
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportReport("csv")}
              className="bg-white/10 text-white border-white/20"
            >
              CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportReport("pdf")}
              className="bg-white/10 text-white border-white/20"
            >
              PDF
            </Button>
            {!completed && (
              <Button
                size="sm"
                onClick={completeAuction}
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-600 text-black"
              >
                Complete
              </Button>
            )}
            {completed && (
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
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Current player + actions */}
        <Card className="lg:col-span-2 border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white text-lg">Current player</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentPlayer ? (
              <>
                <div className="flex gap-4 items-start">
                  {currentPlayer.photo ? (
                    <img
                      src={currentPlayer.photo}
                      alt=""
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-white/10 flex items-center justify-center text-2xl text-white">
                      {currentPlayer.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {currentPlayer.name}
                    </h3>
                    <p className="text-gray-400">
                      {currentPlayer.role}
                      {currentPlayer.age ? ` · Age ${currentPlayer.age}` : ""}
                    </p>
                    <p className="text-emerald-400 mt-1">
                      Base {formatINR(currentPlayer.basePrice)}
                    </p>
                  </div>
                </div>

                {!completed && (
                  <div className="grid sm:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1 sm:col-span-1">
                      <Label className="text-gray-300 text-xs">Team</Label>
                      <Select
                        value={selectedTeamId}
                        onValueChange={setSelectedTeamId}
                      >
                        <SelectTrigger className="bg-white/10 border-white/20 text-white">
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
                      <Label className="text-gray-300 text-xs">Amount</Label>
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-white/10 border-white/20 text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={registerSale}
                        disabled={loading}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black"
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
              <p className="text-gray-400">
                {completed
                  ? "Auction completed."
                  : "No pending players left — export or complete."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Teams purses */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white text-lg">Teams</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {auction.teams.map((at) => (
              <button
                key={at.team.id}
                type="button"
                disabled={completed || !currentPlayer}
                onClick={() => setSelectedTeamId(at.team.id)}
                className={`w-full text-left p-3 rounded-lg border transition ${
                  selectedTeamId === at.team.id
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="text-white font-medium">{at.team.name}</div>
                <div className="text-xs text-gray-400 mt-1">
                  Purse {formatINR(at.team.wallet)} · Squad{" "}
                  {squadCounts.get(at.team.id) || 0}/{auction.maxSquadSize || 25}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Player queue */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white text-lg">
            Player queue (CSV order)
          </CardTitle>
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
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${
                    isCurrent
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-transparent hover:bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 text-left min-w-0"
                    disabled={completed || !isPending}
                    onClick={() => isPending && setCurrent(p.id)}
                  >
                    <span className="text-gray-500 text-xs mr-2">{idx + 1}.</span>
                    <span className="text-white font-medium">{p.name}</span>
                    <span className="text-gray-500 text-sm ml-2">{p.role}</span>
                    {isCurrent && (
                      <span className="ml-2 text-xs text-emerald-400">
                        CURRENT
                      </span>
                    )}
                    {sale && (
                      <span className="ml-2 text-xs text-emerald-300">
                        SOLD → {sale.team.name} @ {formatINR(sale.price)}
                      </span>
                    )}
                    {isUnsold && !sale && (
                      <span className="ml-2 text-xs text-amber-400">UNSOLD</span>
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
