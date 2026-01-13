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
  AlertTriangle,
  FileSpreadsheet,
  Users,
  Trophy,
  Plus,
  Trash2,
  Image as ImageIcon,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { parseCSV, jsonToCSV } from "@/lib/utils";

const AuctionTab = () => {
  const { toast } = useToast();
  const [currentAuction, setCurrentAuction] = useState<any>(null);
  const [auctionName, setAuctionName] = useState("");

  // Lists of data to be submitted (Unified arrays for CSV + Manual)
  const [teamsData, setTeamsData] = useState<any[]>([]);
  const [playersData, setPlayersData] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Manual Dialog States
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);

  // Manual Form States
  const [teamForm, setTeamForm] = useState({
    name: "",
    wallet: 10000000,
    owner: "",
    code: "",
    logo: "🏆",
    captain: "",
    captainEmail: "",
  });
  const [playerForm, setPlayerForm] = useState({
    name: "",
    role: "All-Rounder",
    basePrice: 1000,
    age: 25,
    batsmanType: "Right-handed",
    bowlerType: "None",
    mobile: "",
    email: "",
    photo: "",
  });

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

  // Gallery Image Handler (Converts file to Base64)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPlayerForm((prev) => ({ ...prev, photo: reader.result as string }));
        toast({
          title: "Image Uploaded",
          description: "Player photo is ready.",
        });
      };
      reader.readAsDataURL(file);
    }
  };

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
          const mappedTeams = parsed.map((p) => ({
            name: p.name || p.team || p["team name"] || "New Team",
            wallet: Number(p.wallet || 10000000),
            owner: p.owner || "Owner",
            logo: p.logo || "🏆",
            captainEmail: p.email || p["captain email"] || "",
          }));
          setTeamsData((prev) => [...prev, ...mappedTeams]);
        } else {
          const mappedPlayers = parsed.map((p) => ({
            name: p.name || "Unknown Player",
            role: p.role || "All-Rounder",
            basePrice: Number(p.baseprice || p.price || 1000),
            age: Number(p.age || 25),
            photo: p.photo || "",
          }));
          setPlayersData((prev) => [...prev, ...mappedPlayers]);
        }
        toast({
          title: "Success",
          description: `Imported data from ${file.name}`,
        });
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to parse CSV.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const createAndStartAuction = async () => {
    if (!auctionName || teamsData.length < 2 || playersData.length === 0) {
      toast({
        title: "Validation Error",
        description:
          "Ensure you have a tournament name, 2+ teams, and players.",
        variant: "destructive",
      });
      return;
    }
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
        toast({
          title: "Success",
          description: "Auction initialized! Captains can now join.",
        });
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
        const flatReport: any[] = [];
        report.teams.forEach((t: any) => {
          t.Roster.forEach((p: any) => {
            flatReport.push({
              Status: "SOLD",
              Team: t.TeamName,
              Captain: t.Captain,
              Player: p.Name,
              Price: p.Price,
            });
          });
        });
        report.unsold.forEach((p: any) => {
          flatReport.push({
            Status: "UNSOLD",
            Team: "-",
            Captain: "-",
            Player: p.Name,
            Price: 0,
          });
        });

        const csvContent = jsonToCSV(flatReport);
        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Results_${auctionName.replace(/\s+/g, "_")}.csv`;
        a.click();

        setCurrentAuction(null);
        setTeamsData([]);
        setPlayersData([]);
        setAuctionName("");
        toast({
          title: "Auction Closed",
          description: "Results saved and data wiped.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const startAuction = async () => {
    setLoading(true);
    await apiFetch(`/auctions/${currentAuction._id}/start`, { method: "POST" });
    setLoading(false);
  };

  const pauseAuction = async () => {
    setLoading(true);
    await apiFetch(`/auctions/${currentAuction._id}/pause`, { method: "POST" });
    setLoading(false);
  };

  const resumeAuction = async () => {
    setLoading(true);
    await apiFetch(`/auctions/${currentAuction._id}/resume`, {
      method: "POST",
    });
    setLoading(false);
  };

  const copyRoomCode = () => {
    if (currentAuction?.roomCode) {
      navigator.clipboard.writeText(currentAuction.roomCode);
      toast({ title: "Copied!", description: "Room code copied to clipboard" });
    }
  };

  return (
    <div className="space-y-6">
      {!currentAuction ? (
        // SETUP INTERFACE
        <Card className="border-amber-500/30 bg-[#1a2332]">
          <CardHeader>
            <CardTitle className="text-white">New Auction Session</CardTitle>
            <CardDescription className="text-gray-400">
              Configure tournament manually or via CSV.
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

            <div className="grid md:grid-cols-2 gap-8">
              {/* TEAMS SECTION */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" /> Teams (
                    {teamsData.length})
                  </h3>
                  <Dialog
                    open={isTeamDialogOpen}
                    onOpenChange={setIsTeamDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Manual
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#1a2332] text-white border-white/10 max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Add Team Manually</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                          <Label>Team Name</Label>
                          <Input
                            placeholder="e.g. Mumbai Indians"
                            value={teamForm.name}
                            onChange={(e) =>
                              setTeamForm({ ...teamForm, name: e.target.value })
                            }
                            className="bg-[#0f1419] border-white/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Budget ($)</Label>
                          <Input
                            type="number"
                            value={teamForm.wallet}
                            onChange={(e) =>
                              setTeamForm({
                                ...teamForm,
                                wallet: Number(e.target.value),
                              })
                            }
                            className="bg-[#0f1419] border-white/20"
                          />
                        </div>
                        {/* NEW FIELD: Captain Name */}
                        <div className="space-y-2">
                          <Label>Captain Name</Label>
                          <Input
                            placeholder="e.g. Rohit Sharma"
                            value={teamForm.captain}
                            onChange={(e) =>
                              setTeamForm({
                                ...teamForm,
                                captain: e.target.value,
                              })
                            }
                            className="bg-[#0f1419] border-white/20"
                          />
                        </div>
                        {/* CRITICAL: Captain Email for Auth */}
                        <div className="space-y-2">
                          <Label>Captain Email (For Login)</Label>
                          <Input
                            type="email"
                            placeholder="captain@example.com"
                            value={teamForm.captainEmail}
                            onChange={(e) =>
                              setTeamForm({
                                ...teamForm,
                                captainEmail: e.target.value,
                              })
                            }
                            className="bg-[#0f1419] border-white/20"
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label>Owner Name</Label>
                          <Input
                            placeholder="Owner Name"
                            value={teamForm.owner}
                            onChange={(e) =>
                              setTeamForm({
                                ...teamForm,
                                owner: e.target.value,
                              })
                            }
                            className="bg-[#0f1419] border-white/20"
                          />
                        </div>
                      </div>
                      <Button
                        className="w-full bg-amber-500 text-black font-bold"
                        disabled={!teamForm.name || !teamForm.captainEmail}
                        onClick={() => {
                          setTeamsData([...teamsData, teamForm]);
                          // Reset form
                          setTeamForm({
                            name: "",
                            wallet: 10000000,
                            owner: "",
                            code: "",
                            logo: "🏆",
                            captain: "",
                            captainEmail: "",
                          });
                          setIsTeamDialogOpen(false);
                          toast({
                            title: "Team Added",
                            description:
                              "Team and Captain staged for creation.",
                          });
                        }}
                      >
                        Add to Staging List
                      </Button>
                    </DialogContent>
                  </Dialog>
                </div>

                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center ${
                    teamsData.length > 0
                      ? "border-green-500/30"
                      : "border-white/10"
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
                    className="cursor-pointer text-xs text-gray-400 block mb-2"
                  >
                    Or Upload Teams CSV
                  </Label>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {teamsData.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-white/5 p-2 rounded text-[10px] text-gray-300"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-white">{t.name}</span>
                          <span className="opacity-60">
                            {t.captainEmail ||
                              "No Email (No User will be created)"}
                          </span>
                        </div>
                        <Trash2
                          className="w-3 h-3 text-red-500 cursor-pointer"
                          onClick={() =>
                            setTeamsData(
                              teamsData.filter((_, idx) => idx !== i)
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* PLAYERS SECTION */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" /> Players (
                    {playersData.length})
                  </h3>
                  <Dialog
                    open={isPlayerDialogOpen}
                    onOpenChange={setIsPlayerDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Manual
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#1a2332] text-white border-white/10 max-w-xl">
                      <DialogHeader>
                        <DialogTitle>Add Player Manually</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="col-span-2 flex items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                            {playerForm.photo ? (
                              <img
                                src={playerForm.photo}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="text-gray-600" />
                            )}
                          </div>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="bg-[#0f1419] border-white/20 text-xs"
                          />
                        </div>
                        <Input
                          placeholder="Player Name"
                          value={playerForm.name}
                          onChange={(e) =>
                            setPlayerForm({
                              ...playerForm,
                              name: e.target.value,
                            })
                          }
                          className="bg-[#0f1419]"
                        />
                        <Input
                          placeholder="Price"
                          type="number"
                          value={playerForm.basePrice}
                          onChange={(e) =>
                            setPlayerForm({
                              ...playerForm,
                              basePrice: Number(e.target.value),
                            })
                          }
                          className="bg-[#0f1419]"
                        />
                        <Select
                          onValueChange={(v) =>
                            setPlayerForm({ ...playerForm, role: v })
                          }
                        >
                          <SelectTrigger className="bg-[#0f1419]">
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Batsman">Batsman</SelectItem>
                            <SelectItem value="Bowler">Bowler</SelectItem>
                            <SelectItem value="All-Rounder">
                              All-Rounder
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        className="w-full bg-amber-500 text-black font-bold"
                        onClick={() => {
                          setPlayersData([...playersData, playerForm]);
                          setPlayerForm({
                            name: "",
                            role: "All-Rounder",
                            basePrice: 1000,
                            age: 25,
                            batsmanType: "Right-handed",
                            bowlerType: "None",
                            mobile: "",
                            email: "",
                            photo: "",
                          });
                          setIsPlayerDialogOpen(false);
                        }}
                      >
                        Add to List
                      </Button>
                    </DialogContent>
                  </Dialog>
                </div>

                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center ${
                    playersData.length > 0
                      ? "border-green-500/30"
                      : "border-white/10"
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
                    className="cursor-pointer text-xs text-gray-400 block mb-2"
                  >
                    Or Upload Players CSV
                  </Label>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {playersData.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-white/5 p-2 rounded text-[10px] text-gray-300"
                      >
                        <span>{p.name}</span>
                        <Trash2
                          className="w-3 h-3 text-red-500 cursor-pointer"
                          onClick={() =>
                            setPlayersData(
                              playersData.filter((_, idx) => idx !== i)
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={createAndStartAuction}
              disabled={
                !auctionName ||
                teamsData.length === 0 ||
                playersData.length === 0 ||
                loading
              }
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 text-lg shadow-lg shadow-amber-900/20"
            >
              {loading ? "Initializing..." : "Create Auction Room"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        // ACTIVE AUCTION CONTROL UI (THIS WAS MISSING BEFORE)
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
              <p className="text-gray-400 text-xs uppercase mb-1 tracking-wider">
                Room Code
              </p>
              <div className="flex items-center gap-2 bg-[#0f1419] px-3 py-1.5 rounded border border-white/10">
                <span className="text-2xl font-mono text-amber-500 font-bold">
                  {currentAuction.roomCode}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white"
                  onClick={copyRoomCode}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentAuction.state === "draft" ? (
                <Button
                  onClick={startAuction}
                  className="bg-green-600 hover:bg-green-700 h-20 text-xl font-bold"
                >
                  <Play className="mr-3 fill-current" /> Start Auction
                </Button>
              ) : currentAuction.state === "paused" ? (
                <Button
                  onClick={resumeAuction}
                  className="bg-green-600 hover:bg-green-700 h-20 text-xl font-bold"
                >
                  <Play className="mr-3 fill-current" /> Resume
                </Button>
              ) : (
                <Button
                  onClick={pauseAuction}
                  className="bg-yellow-600 hover:bg-yellow-700 h-20 text-xl font-bold text-black"
                >
                  <Pause className="mr-3 fill-current" /> Pause
                </Button>
              )}
              <Button
                onClick={() => setShowEndConfirm(true)}
                variant="destructive"
                className="h-20 text-xl border-2 border-red-900/50 bg-transparent text-red-500 font-bold"
              >
                <FileSpreadsheet className="mr-2" /> End & Download CSV
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#0f1419] p-4 rounded-lg border border-white/10 text-center">
                <div className="text-3xl font-bold text-green-500">
                  {(currentAuction.sales || []).length}
                </div>
                <div className="text-[10px] text-gray-400 uppercase">Sold</div>
              </div>
              <div className="bg-[#0f1419] p-4 rounded-lg border border-white/10 text-center">
                <div className="text-3xl font-bold text-amber-500">
                  {(currentAuction.unsoldPlayers || []).length}
                </div>
                <div className="text-[10px] text-gray-400 uppercase">
                  Unsold
                </div>
              </div>
              <div className="bg-[#0f1419] p-4 rounded-lg border border-white/10 text-center">
                <div className="text-xl font-bold text-blue-500 mt-2">
                  $
                  {(currentAuction.sales || [])
                    .reduce((acc: any, s: any) => acc + s.price, 0)
                    .toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-400 uppercase">Spent</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* END AUCTION CONFIRMATION */}
      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent className="bg-[#1a2332] border-red-500/50 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle /> End Auction & Wipe Data?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              This will close the room permanently, download results, and clear
              the database for a fresh start.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={closeAndWipe}
              className="bg-red-600 font-bold"
            >
              Download & Wipe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AuctionTab;
