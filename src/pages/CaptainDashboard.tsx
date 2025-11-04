import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Gavel, LogOut } from "lucide-react";
import AuctionRoom from "@/components/auction/AuctionRoom";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api";

const CaptainDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [roomCode, setRoomCode] = useState("");
  const [inAuction, setInAuction] = useState(false);
  const [teamName, setTeamName] = useState<string>("My Team");

  // Fetch team name
  useEffect(() => {
    if (user?.teamId) {
      apiFetch(`/teams/${user.teamId}`)
        .then(async (res) => {
          if (res.ok) {
            const { team } = await res.json();
            setTeamName(team?.name || "My Team");
          }
        })
        .catch(() => {
          // Fallback to teamId if fetch fails
          setTeamName("My Team");
        });
    }
  }, [user?.teamId]);

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
      description: `Entering room: ${roomCode}`,
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
        role="captain"
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
              <Gavel className="w-8 h-8 text-amber-500" />
            </div>
            <div className="text-white">
              <h1 className="text-2xl font-bold">{teamName}</h1>
              <p className="text-sm text-gray-400">{user?.name || "Captain"}</p>
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
                <Gavel className="w-10 h-10 text-amber-500" />
              </div>
              <CardTitle className="text-3xl text-white">
                Join Auction Room
              </CardTitle>
              <p className="text-gray-400">Enter the code provided by admin</p>
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
                  Join Auction
                </Button>
              </form>

              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-gray-300">
                  Enter the 6-digit room code provided by the admin to join the
                  live auction. Once inside, you'll be able to bid on players
                  for your team.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CaptainDashboard;
