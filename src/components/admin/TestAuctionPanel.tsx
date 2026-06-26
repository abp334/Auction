import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Copy, FlaskConical, RefreshCw } from "lucide-react";

type TestCredentials = {
  captains: Array<{ team: string; email: string; password: string }>;
  players: Array<{ name: string; email: string; password: string }>;
};

type SeedResult = {
  auction: { id: string; name: string; roomCode: string; state: string };
  credentials: TestCredentials;
};

const TestAuctionPanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);

  useEffect(() => {
    apiFetch("/invites")
      .then((res) => setIsSuperAdmin(res.ok))
      .finally(() => setChecking(false));
  }, []);

  const handleSeed = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/auctions/seed-test", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        toast({
          title: "Test auction created",
          description: `Room code: ${data.auction.roomCode}. Refresh to open it in the control panel.`,
        });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Failed",
          description: err.error || "Could not create test auction.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!result) return;
    const lines = [
      `Room Code: ${result.auction.roomCode}`,
      "",
      "CAPTAINS (password = team name without spaces):",
      ...result.credentials.captains.map(
        (c) => `${c.team} | ${c.email} | ${c.password}`
      ),
      "",
      "PLAYERS (password = name without spaces):",
      ...result.credentials.players.map(
        (p) => `${p.name} | ${p.email} | ${p.password}`
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast({ title: "Copied", description: "All test logins copied." });
  };

  if (checking) return null;
  if (!isSuperAdmin) return null;

  return (
    <Card className="border-amber-500/20 bg-white/5 backdrop-blur-sm mt-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-white">Test Auction Setup</CardTitle>
        </div>
        <CardDescription className="text-gray-400">
          One click: 4 teams, 12 players, all logins use @test.clashbid only.
          Sandbox data is hidden from regular admins and never mixed into production lists.
          Re-running replaces the previous test auction.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSeed}
            disabled={loading}
            className="bg-amber-500 text-black font-bold hover:bg-amber-400"
          >
            {loading ? "Creating..." : "Create Test Auction"}
          </Button>
          {result && (
            <>
              <Button
                variant="outline"
                onClick={copyAll}
                className="border-white/20 text-white"
              >
                <Copy className="w-4 h-4 mr-2" /> Copy All Logins
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="border-white/20 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh Dashboard
              </Button>
            </>
          )}
        </div>

        {result && (
          <div className="space-y-4 text-sm">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-amber-400 font-bold text-lg font-mono">
                Room: {result.auction.roomCode}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                State: {result.auction.state} — refresh, then click Start Auction
              </p>
            </div>

            <div>
              <p className="text-white font-semibold mb-2">Captains</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.credentials.captains.map((c) => (
                  <div
                    key={c.email}
                    className="text-xs text-gray-300 border-b border-white/5 pb-1 font-mono"
                  >
                    {c.team} · {c.email} · pwd: {c.password}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-white font-semibold mb-2">
                Players (spectator logins)
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.credentials.players.map((p) => (
                  <div
                    key={p.email}
                    className="text-xs text-gray-300 border-b border-white/5 pb-1 font-mono"
                  >
                    {p.name} · {p.email} · pwd: {p.password}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TestAuctionPanel;
