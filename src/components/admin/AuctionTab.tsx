import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Clock,
  Copy,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Settings,
  History,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

const AuctionTab = () => {
  const { toast } = useToast();
  const [auctions, setAuctions] = useState<any[]>([]);
  const [currentAuction, setCurrentAuction] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [roomCode, setRoomCode] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [auctionName, setAuctionName] = useState("");
  const [bidIncrement, setBidIncrement] = useState("1000");
  const [timerDuration, setTimerDuration] = useState("30");
  const [loading, setLoading] = useState(false);

  const loadPlayers = useCallback(async () => {
    const pRes = await apiFetch("/players");
    if (pRes.ok) {
      const { players } = await pRes.json();
      // Filter out players already sold (have teamId)
      setAllPlayers(players.filter((p: any) => !p.teamId));
    }
  }, []);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/auctions");
      if (res.ok) {
        const { auctions } = await res.json();
        setAuctions(auctions);
        const active = auctions.find(
          (a: any) =>
            a.state === "active" || a.state === "draft" || a.state === "paused"
        );
        if (active) {
          setCurrentAuction(active);
          setRoomCode(active.roomCode);
        }
      }
      await loadPlayers();
    })();
  }, []);

  // Refresh players and auction state periodically when auction is active
  useEffect(() => {
    if (
      !currentAuction ||
      (currentAuction.state !== "active" && currentAuction.state !== "paused")
    )
      return;

    const interval = setInterval(async () => {
      // Refresh auction state
      const res = await apiFetch(`/auctions/${currentAuction._id}`);
      if (res.ok) {
        const { auction } = await res.json();
        setCurrentAuction(auction);
      }
      // Refresh players list
      await loadPlayers();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [currentAuction?._id, currentAuction?.state, loadPlayers]);

  const createAuction = async () => {
    if (!auctionName) {
      toast({
        title: "Error",
        description: "Please enter auction name",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const res = await apiFetch("/auctions", {
      method: "POST",
      body: JSON.stringify({ name: auctionName, players: [], teams: [] }),
    });
    if (res.ok) {
      const { auction } = await res.json();
      setCurrentAuction(auction);
      setRoomCode(auction.roomCode);
      setAuctions((a) => [auction, ...a]);
      toast({
        title: "Success",
        description: `Auction created! Room code: ${auction.roomCode}`,
      });
    } else {
      toast({ title: "Error", description: "Failed to create auction" });
    }
    setLoading(false);
  };

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      toast({ title: "Copied!", description: "Room code copied to clipboard" });
    }
  };

  const scheduleAuction = () => {
    if (!scheduleDate || !scheduleTime) {
      toast({
        title: "Error",
        description: "Please select date and time",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Auction Scheduled",
      description: `Set for ${scheduleDate} at ${scheduleTime}`,
    });
  };

  const startAuction = async () => {
    if (!currentAuction) {
      toast({
        title: "Error",
        description: "Please create an auction first",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const res = await apiFetch(`/auctions/${currentAuction._id}/start`, {
      method: "POST",
    });
    if (res.ok) {
      const { auction } = await res.json();
      setCurrentAuction(auction);
      await loadPlayers(); // Refresh players list
      toast({
        title: "Auction Started!",
        description: "First player automatically selected - bidding is live",
      });
    } else {
      toast({ title: "Error", description: "Failed to start auction" });
    }
    setLoading(false);
  };

  const pauseAuction = async () => {
    if (!currentAuction) return;
    setLoading(true);
    const res = await apiFetch(`/auctions/${currentAuction._id}/pause`, {
      method: "POST",
    });
    if (res.ok) {
      const { auction } = await res.json();
      setCurrentAuction(auction);
      toast({
        title: "Auction Paused",
        description: "Bidding is temporarily stopped",
      });
    } else {
      toast({ title: "Error", description: "Failed to pause auction" });
    }
    setLoading(false);
  };

  const resumeAuction = async () => {
    if (!currentAuction) return;
    setLoading(true);
    const res = await apiFetch(`/auctions/${currentAuction._id}/resume`, {
      method: "POST",
    });
    if (res.ok) {
      const { auction } = await res.json();
      setCurrentAuction(auction);
      toast({
        title: "Auction Resumed",
        description: "Bidding is now active again",
      });
    } else {
      toast({ title: "Error", description: "Failed to resume auction" });
    }
    setLoading(false);
  };

  const closeAuction = async () => {
    if (!currentAuction) return;
    setLoading(true);
    const res = await apiFetch(`/auctions/${currentAuction._id}/close`, {
      method: "POST",
    });
    if (res.ok) {
      const { auction } = await res.json();
      setCurrentAuction(null);
      setRoomCode("");
      toast({ title: "Auction Closed", description: "Auction has been ended" });
    } else {
      toast({ title: "Error", description: "Failed to close auction" });
    }
    setLoading(false);
  };

  // Note: setCurrentPlayer is kept for manual override if needed, but auto-cycling is now primary
  const setCurrentPlayer = async (playerId: string) => {
    if (!currentAuction) return;
    setLoading(true);
    const res = await apiFetch(`/auctions/${currentAuction._id}/current`, {
      method: "POST",
      body: JSON.stringify({ playerId }),
    });
    if (res.ok) {
      const { auction } = await res.json();
      setCurrentAuction(auction);
      await loadPlayers(); // Refresh players list
      toast({
        title: "Player Set",
        description: "Current player updated - all clients notified",
      });
    } else {
      toast({ title: "Error", description: "Failed to set current player" });
    }
    setLoading(false);
  };

  const auctionStatus = currentAuction?.state || "idle";
  const auctionHistory = currentAuction?.sales || [];

  return (
    <Tabs defaultValue="control" className="space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="control">Control</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>

      <TabsContent value="control" className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Room Management */}
          <Card>
            <CardHeader>
              <CardTitle>Auction Room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Auction Name</Label>
                <Input
                  value={auctionName}
                  onChange={(e) => setAuctionName(e.target.value)}
                  placeholder="Enter auction name"
                />
                <Button
                  onClick={createAuction}
                  disabled={loading || !auctionName}
                  className="w-full"
                >
                  Create Auction
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Room Code</Label>
                <div className="flex gap-2">
                  <Input
                    value={roomCode}
                    readOnly
                    placeholder="Create auction first"
                    className="font-mono text-2xl text-center tracking-wider"
                  />
                  <Button
                    onClick={copyRoomCode}
                    size="icon"
                    variant="outline"
                    disabled={!roomCode}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Share this code with captains and players
                </p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      auctionStatus === "active"
                        ? "bg-green-500"
                        : auctionStatus === "paused"
                        ? "bg-yellow-500"
                        : "bg-gray-500"
                    }`}
                  />
                  <span className="font-medium capitalize">
                    {auctionStatus}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Schedule Auction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Date
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Time
                </Label>
                <Input
                  id="time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
              <Button onClick={scheduleAuction} className="w-full">
                Schedule Auction
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Auction Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Live Auction Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {auctionStatus === "draft" && (
                <Button
                  onClick={startAuction}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Auction
                </Button>
              )}
              {auctionStatus === "active" && (
                <Button
                  onClick={pauseAuction}
                  disabled={loading}
                  className="w-full bg-yellow-600 hover:bg-yellow-700"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              )}
              {auctionStatus === "paused" && (
                <Button
                  onClick={resumeAuction}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              )}
              <Button
                variant="destructive"
                disabled={
                  auctionStatus === "idle" || !currentAuction || loading
                }
                onClick={closeAuction}
              >
                End Auction
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Current Player Info */}
        {currentAuction &&
          (auctionStatus === "active" || auctionStatus === "paused") && (
            <Card>
              <CardHeader>
                <CardTitle>Current Player Status</CardTitle>
              </CardHeader>
              <CardContent>
                {currentAuction.currentPlayerId ? (
                  <div className="text-center py-4">
                    <p className="text-lg font-semibold text-green-600">
                      ✓ Player is currently being auctioned
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Players will automatically advance after each sale
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-lg font-semibold text-amber-600">
                      No current player - All players sold or auction completed
                    </p>
                  </div>
                )}
                {allPlayers.length > 0 && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p>
                      Remaining unsold players:{" "}
                      <strong>{allPlayers.length}</strong>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        {/* Current Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-accent">5</div>
              <p className="text-sm text-muted-foreground">Active Teams</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-accent">12</div>
              <p className="text-sm text-muted-foreground">Players Sold</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-accent">$145K</div>
              <p className="text-sm text-muted-foreground">Total Spent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-accent">38</div>
              <p className="text-sm text-muted-foreground">Remaining Players</p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="settings" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <Settings className="w-5 h-5 inline mr-2" />
              Auction Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="bidIncrement">Bid Increment ($)</Label>
                <Select value={bidIncrement} onValueChange={setBidIncrement}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="500">$500</SelectItem>
                    <SelectItem value="1000">$1,000</SelectItem>
                    <SelectItem value="2000">$2,000</SelectItem>
                    <SelectItem value="5000">$5,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timerDuration">Timer Duration (seconds)</Label>
                <Select value={timerDuration} onValueChange={setTimerDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 seconds</SelectItem>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="45">45 seconds</SelectItem>
                    <SelectItem value="60">60 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minPlayers">Min Players per Team</Label>
                <Input id="minPlayers" type="number" defaultValue="11" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPlayers">Max Players per Team</Label>
                <Input id="maxPlayers" type="number" defaultValue="15" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseBid">Default Base Bid ($)</Label>
                <Input id="baseBid" type="number" defaultValue="5000" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxBid">Maximum Bid Limit ($)</Label>
                <Input id="maxBid" type="number" defaultValue="50000" />
              </div>
            </div>

            <Button className="w-full">Save Settings</Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <History className="w-5 h-5 inline mr-2" />
              Auction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {auctionHistory.length === 0 ? (
                <div className="text-muted-foreground p-4 text-center">
                  No sales yet
                </div>
              ) : (
                auctionHistory.map((item: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-muted rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">
                        Player ID: {item.playerId}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Team ID: {item.teamId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-accent">
                        ${item.price?.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default AuctionTab;
