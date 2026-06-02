import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Loader2 } from "lucide-react";
import AuctionRoom from "@/components/auction/AuctionRoom";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.png";

const PlayerView = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [auction, setAuction] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Resolve the auction this player is enrolled in (no room code needed).
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiFetch("/auctions");
        if (res.ok) {
          const { auctions } = await res.json();
          const active =
            (auctions || []).find((a: any) => a.state !== "completed") || null;
          if (mounted) setAuction(active);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#0f1419] text-white">
        <div className="flex items-center gap-3 text-amber-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading your auction...</span>
        </div>
      </div>
    );
  }

  // Enrolled in a live auction — drop the player straight into spectator view.
  if (auction) {
    return (
      <AuctionRoom
        role="player"
        roomCode={auction.roomCode}
        onExit={() => navigate("/")}
      />
    );
  }

  // No active auction (e.g. it was ended & wiped by the organizer).
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
              <CardTitle className="text-2xl text-white">
                No Active Auction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 text-center">
                You are not currently part of a live auction. The organizer may
                not have started it yet, or it has already ended. Please contact
                your auction organizer.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PlayerView;
