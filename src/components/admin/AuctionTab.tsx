import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Play,
  Pause,
  Upload,
  Download,
  AlertTriangle,
  FileSpreadsheet,
  Users,
  Trophy,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/api";
import { parseCSV, jsonToCSV } from "@/lib/utils";

const AuctionTab = () => {
  const { toast } = useToast();
  const [currentAuction, setCurrentAuction] = useState<any>(null);
  const [auctionName, setAuctionName] = useState("");

  // Separate states for the two CSVs
  const [teamsData, setTeamsData] = useState<any[] | null>(null);
  const [playersData, setPlayersData] = useState<any[] | null>(null);

  const [loading, setLoading] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Check for active auction on load
  useEffect(() => {
    const checkActive = async () => {
      const res = await apiFetch("/auctions");
      if (res.ok) {
        const { auctions } = await res.json();
        const active = auctions.find(
          (a: any) =>
            a.state === "active" || a.state === "draft" || a.state === "paused"
        );
        if (active) setCurrentAuction(active);
      }
    };
    checkActive();
  }, []);

  // Poll for updates if active
  useEffect(() => {
    if (!currentAuction || currentAuction.state === "completed") return;
    const interval = setInterval(async () => {
      const res = await apiFetch(`/auctions/${currentAuction._id}`);
      if (res.ok) {
        const { auction } = await res.json();
        setCurrentAuction(auction);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentAuction?._id, currentAuction?.state]);

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
          // Expected CSV Headers: Name, Wallet, Owner, Code, Captain Email
          const mappedTeams = parsed.map((p) => ({
            name:
              p.name ||
              p.team ||
              p["team name"] ||
              `Team ${Math.random().toString().substr(2, 4)}`,
            wallet: Number(p.wallet || p.purse || p.budget || 10000000),
            owner: p.owner || "Owner",
            code:
              p.code || p.shortcode || p.name?.substring(0, 3).toUpperCase(),
            logo: p.logo || p.icon || "🏆",
            captain: p.captain || p["captain name"],
            // CRITICAL FIX: Map captain email correctly
            captainEmail:
              p.email ||
              p["captain email"] ||
              p["captain_email"] ||
              p.captainemail ||
              "",
          }));
          setTeamsData(mappedTeams);
          toast({
            title: "Teams Loaded",
            description: `Found ${mappedTeams.length} teams`,
          });
        } else {
          // Expected CSV Headers: Name, Role, BasePrice, Age
          const mappedPlayers = parsed.map((p) => ({
            name: p.name || p.player || "Unknown Player",
            role: p.role || p.type || "All-Rounder",
            basePrice: Number(
              p.baseprice || p["base price"] || p.price || 1000
            ),
            age: Number(p.age || 25),
            batsmanType:
              p.batsmantype ||
              p["batting style"] ||
              p.batting ||
              "Right-handed",
            bowlerType:
              p.bowlertype || p["bowling style"] || p.bowling || "None",
            mobile: p.mobile || p.phone || p.contact,
            email: p.email || p["email address"],
            photo: p.photo || p.image || p.url,
          }));
          setPlayersData(mappedPlayers);
          toast({
            title: "Players Loaded",
            description: `Found ${mappedPlayers.length} players`,
          });
        }
      } catch (err) {
        console.error(err);
        toast({
          title: "Error",
          description: "Failed to parse CSV. Check format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const createAndStartAuction = async () => {
    if (!auctionName || !teamsData || !playersData) return;
    setLoading(true);

    try {
      const res = await apiFetch("/auctions", {
        method: "POST",
        body: JSON.stringify({
          name: auctionName,
          teams: teamsData,
          players: playersData,
        }),
      });

      if (res.ok) {
        const { auction } = await res.json();
        setCurrentAuction(auction);
        toast({ title: "Success", description: "Auction initialized!" });
      } else {
        const err = await res.json();
        toast({
          title: "Error",
          description: err.error,
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to create auction",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const closeAndWipe = async () => {
    if (!currentAuction) return;
    setShowEndConfirm(false);
    setLoading(true);

    try {
      const res = await apiFetch(`/auctions/${currentAuction._id}/close`, {
        method: "POST",
      });
      if (res.ok) {
        const { report } = await res.json();

        // --- FLATTEN REPORT FOR CSV ---
        const flatReport: any[] = [];

        // 1. Sold Players
        report.teams.forEach((t: any) => {
          t.Roster.forEach((p: any) => {
            flatReport.push({
              Status: "SOLD",
              Team: t.TeamName,
              Captain: t.Captain,
              Player: p.Name,
              Role: p.Role,
              Mobile: p.Mobile || "",
              Email: p.Email || "",
              Price: p.Price,
            });
          });
        });

        // 2. Unsold Players
        report.unsold.forEach((p: any) => {
          flatReport.push({
            Status: "UNSOLD",
            Team: "-",
            Captain: "-",
            Player: p.Name,
            Role: p.Role,
            Mobile: p.Mobile || "",
            Email: p.Email || "",
            Price: 0,
          });
        });

        // Convert to CSV
        const csvContent = jsonToCSV(flatReport);
        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Auction_Results_${auctionName.replace(/\s+/g, "_")}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setCurrentAuction(null);
        setTeamsData(null);
        setPlayersData(null);
        setAuctionName("");

        toast({
          title: "Auction Closed",
          description: "Results downloaded as CSV. Data erased.",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to close auction",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const startAuction = async () => {
    if (!currentAuction) return;
    setLoading(true);
    await apiFetch(`/auctions/${currentAuction._id}/start`, { method: "POST" });
    setLoading(false);
  };

  const pauseAuction = async () => {
    if (!currentAuction) return;
    setLoading(true);
    await apiFetch(`/auctions/${currentAuction._id}/pause`, { method: "POST" });
    setLoading(false);
  };

  const resumeAuction = async () => {
    if (!currentAuction) return;
    setLoading(true);
    await apiFetch(`/auctions/${currentAuction._id}/resume`, {
      method: "POST",
    });
    setLoading(false);
  };

  const copyRoomCode = () => {
    if (currentAuction?.roomCode) {
      navigator.clipboard.writeText(currentAuction.roomCode);
      toast({ title: "Copied!", description: "Room code copied" });
    }
  };

  return (
    <div className="space-y-6">
      {!currentAuction ? (
        // STATE 1: SETUP
        <Card className="border-amber-500/30 bg-[#1a2332]">
          <CardHeader>
            <CardTitle className="text-white">New Auction Session</CardTitle>
            <CardDescription className="text-gray-400">
              Upload your Excel/CSV lists to start.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-white">Tournament Name</Label>
              <Input
                value={auctionName}
                onChange={(e) => setAuctionName(e.target.value)}
                placeholder="e.g. Premier League 2025"
                className="bg-[#0f1419] border-white/20 text-white"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Teams Upload */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  teamsData
                    ? "border-green-500/50 bg-green-500/10"
                    : "border-white/20 hover:border-amber-500/50"
                }`}
              >
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleCsvUpload(e, "teams")}
                  className="hidden"
                  id="teams-upload"
                />
                <Label
                  htmlFor="teams-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Trophy
                    className={`w-8 h-8 ${
                      teamsData ? "text-green-500" : "text-amber-500"
                    }`}
                  />
                  <span className="text-white font-bold">
                    1. Upload Teams CSV
                  </span>
                  <span className="text-xs text-gray-400">
                    Columns: Name, Wallet, Logo, Captain Email
                  </span>
                  {teamsData && (
                    <span className="text-green-400 text-xs font-bold">
                      Loaded {teamsData.length} Teams
                    </span>
                  )}
                </Label>
              </div>

              {/* Players Upload */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  playersData
                    ? "border-green-500/50 bg-green-500/10"
                    : "border-white/20 hover:border-amber-500/50"
                }`}
              >
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleCsvUpload(e, "players")}
                  className="hidden"
                  id="players-upload"
                />
                <Label
                  htmlFor="players-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Users
                    className={`w-8 h-8 ${
                      playersData ? "text-green-500" : "text-amber-500"
                    }`}
                  />
                  <span className="text-white font-bold">
                    2. Upload Players CSV
                  </span>
                  <span className="text-xs text-gray-400">
                    Cols: Name, Role, Price, Phone, Email
                  </span>
                  {playersData && (
                    <span className="text-green-400 text-xs font-bold">
                      Loaded {playersData.length} Players
                    </span>
                  )}
                </Label>
              </div>
            </div>

            <Button
              onClick={createAndStartAuction}
              disabled={!auctionName || !teamsData || !playersData || loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 text-lg"
            >
              {loading ? "Initializing..." : "Create Auction Room"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        // STATE 2: ACTIVE AUCTION
        <Card className="border-green-500/30 bg-[#1a2332]">
          <CardHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-6">
            <div>
              <CardTitle className="text-white text-2xl">
                {currentAuction.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    currentAuction.state === "active"
                      ? "bg-green-500 animate-pulse"
                      : "bg-yellow-500"
                  }`}
                />
                <span className="text-sm text-gray-300 capitalize">
                  {currentAuction.state}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                Room Code
              </p>
              <div className="flex items-center gap-2 bg-[#0f1419] px-3 py-1.5 rounded border border-white/10">
                <span className="text-2xl font-mono text-amber-500 font-bold tracking-widest">
                  {currentAuction.roomCode}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:bg-white/10"
                  onClick={copyRoomCode}
                >
                  <Copy className="w-4 h-4 text-white" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentAuction.state === "draft" ? (
                <Button
                  onClick={startAuction}
                  className="bg-green-600 hover:bg-green-700 h-20 text-xl font-bold shadow-lg shadow-green-900/20"
                >
                  <Play className="w-6 h-6 mr-3 fill-current" /> Start Auction
                </Button>
              ) : currentAuction.state === "paused" ? (
                <Button
                  onClick={resumeAuction}
                  className="bg-green-600 hover:bg-green-700 h-20 text-xl font-bold"
                >
                  <Play className="w-6 h-6 mr-3 fill-current" /> Resume
                </Button>
              ) : (
                <Button
                  onClick={pauseAuction}
                  className="bg-yellow-600 hover:bg-yellow-700 h-20 text-xl font-bold text-black"
                >
                  <Pause className="w-6 h-6 mr-3 fill-current" /> Pause
                </Button>
              )}

              <Button
                onClick={() => setShowEndConfirm(true)}
                variant="destructive"
                className="h-20 text-xl border-2 border-red-900/50 hover:bg-red-900/40 bg-transparent text-red-500 hover:text-red-400"
              >
                <div className="flex flex-col items-center">
                  <span className="flex items-center font-bold">
                    <FileSpreadsheet className="w-5 h-5 mr-2" /> End & Download
                    CSV
                  </span>
                  <span className="text-xs font-normal opacity-70 mt-1">
                    Saves results & resets data
                  </span>
                </div>
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#0f1419] p-4 rounded-lg border border-white/10 text-center">
                <div className="text-3xl font-bold text-green-500 mb-1">
                  {(currentAuction.sales || []).length}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wider">
                  Sold
                </div>
              </div>
              <div className="bg-[#0f1419] p-4 rounded-lg border border-white/10 text-center">
                <div className="text-3xl font-bold text-amber-500 mb-1">
                  {(currentAuction.unsoldPlayers || []).length}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wider">
                  Unsold
                </div>
              </div>
              <div className="bg-[#0f1419] p-4 rounded-lg border border-white/10 text-center">
                <div className="text-3xl font-bold text-blue-500 mb-1">
                  $
                  {(currentAuction.sales || [])
                    .reduce((acc: number, s: any) => acc + s.price, 0)
                    .toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wider">
                  Total Spent
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent className="bg-[#1a2332] border-red-500/50 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-500 text-xl">
              <AlertTriangle className="w-6 h-6" />
              End Auction & Erase Data?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-gray-300 text-base mt-2">
                You are about to close this session.
                <ul className="list-disc pl-5 mt-3 space-y-1 text-sm text-gray-400">
                  <li>
                    A <strong>CSV file</strong> with all sold/unsold players
                    will be downloaded.
                  </li>
                  <li>
                    All <strong>Players</strong> and <strong>Teams</strong> data
                    will be{" "}
                    <span className="text-red-400 font-bold">
                      PERMANENTLY DELETED
                    </span>
                    .
                  </li>
                  <li>The room code will become invalid.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={closeAndWipe}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              Download CSV & Wipe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AuctionTab;
