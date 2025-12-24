import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Gavel, LogOut } from "lucide-react";
import AuctionRoom from "@/components/auction/AuctionRoom";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.png";
const PlayerView = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [roomCode, setRoomCode] = useState("");
  const [inAuction, setInAuction] = useState(false);

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomCode) {
      toast({
        title: "Error",
        description: "Please enter a room code",
        variant: "destructive",
      });
      return;
    }
    // Validate room code with backend
    const res = await apiFetch(
      `/auctions?roomCode=${encodeURIComponent(roomCode)}`
    );
    if (!res.ok) {
      toast({
        title: "Invalid Room",
        description: "Unable to reach server or room lookup failed.",
        variant: "destructive",
      });
      return;
    }
    const { auctions } = await res.json();
    const auction = auctions[0];
    if (!auction) {
      toast({
        title: "Invalid Room",
        description: "No auction found for this room code.",
        variant: "destructive",
      });
      return;
    }
    // Allow joining if auction is active, paused, or draft (not completed)
    if (auction.state === "completed") {
      toast({
        title: "Auction Ended",
        description: "This auction has been completed.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Joined Auction",
      description: `Watching room: ${roomCode}`,
    });
    setInAuction(true);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (inAuction) {
    return (
      <AuctionRoom
        role="player"
        roomCode={roomCode}
        onExit={() => setInAuction(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#0f1419]">
      <header className="border-b border-amber-500/30 bg-[#0f1419]/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500">
              <img
                src={logo}
                alt="ClashBid Logo"
                className="w-6 h-6 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <div className="text-white">
              <h1 className="text-2xl font-bold">Spectator View</h1>
              <p className="text-sm text-gray-400">{user?.name || "Player"}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={handleLogout}
            className="border border-amber-500/30"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <Card className="shadow-2xl border-amber-500/30 bg-[#1a2332]">
            <CardHeader className="text-center space-y-4">
              <div className="bg-amber-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-amber-500">
                <img
                  src={logo}
                  alt="ClashBid Logo"
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
              <CardTitle className="text-3xl text-white">
                Watch Auction
              </CardTitle>
              <p className="text-gray-400">
                Enter the code to spectate live auction
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoinRoom} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="roomCode" className="text-white text-base">
                    Room Code
                  </Label>
                  <Input
                    id="roomCode"
                    placeholder="ABC123"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="text-center text-3xl tracking-widest font-mono bg-[#0f1419] border-amber-500/30 text-white h-16"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-primary font-bold"
                  size="lg"
                >
                  <Gavel className="w-5 h-5 mr-2" />
                  Join as Spectator
                </Button>
              </form>

              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-gray-300">
                  Enter the 6-digit room code to watch the live auction. You'll
                  see current player information, team standings, and live
                  commentary as players are sold.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PlayerView;
