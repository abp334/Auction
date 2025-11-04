import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Gavel } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<"admin" | "captain" | "player">("player");
  const [teamId, setTeamId] = useState("");
  const [teams, setTeams] = useState<Array<{ _id: string; name: string }>>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, login, signup } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === "admin") navigate("/admin");
      else if (user.role === "captain") navigate("/captain");
      else navigate("/player");
    }
  }, [user, navigate]);

  // Load teams when role is captain in signup mode
  useEffect(() => {
    if (!isLogin && role === "captain") {
      setLoadingTeams(true);
      // Use fetch directly without auth token for public endpoint
      fetch(`${import.meta.env.VITE_API_URL || "/api/v1"}/teams`)
        .then(async (res) => {
          if (res.ok) {
            const { teams } = await res.json();
            setTeams(teams || []);
          } else {
            setTeams([]);
          }
        })
        .catch(() => {
          setTeams([]);
        })
        .finally(() => {
          setLoadingTeams(false);
        });
    } else {
      setTeams([]);
      setTeamId("");
    }
  }, [isLogin, role]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    setPasswordError("");
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    if (!isLogin && password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }
    if (!isLogin && role === "captain" && !teamId) {
      toast({
        title: "Error",
        description: "Please select a team for captain registration",
        variant: "destructive",
      });
      return;
    }
    const ok = isLogin
      ? await login(email, password)
      : await signup({
          email,
          password,
          name: email.split("@")[0],
          role,
          teamId: role === "captain" ? teamId : undefined,
        });

    if (!ok) {
      toast({
        title: "Error",
        description: "Invalid credentials",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Success", description: `Welcome!` });
    // Navigation will happen via useEffect when user state updates
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#0f1419] p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-72 h-72 bg-amber-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-amber-500 rounded-full blur-3xl"></div>
      </div>
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-amber-500/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-amber-500/10 p-4 rounded-full border-2 border-amber-500">
              <Gavel className="w-12 h-12 text-amber-500" />
            </div>
          </div>
          <CardTitle className="text-3xl mb-2">Elite Sports Auction</CardTitle>
          <CardDescription className="text-base">
            {isLogin ? "Sign in to your account" : "Create a new account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full ${
                  passwordError ? "border border-red-500" : ""
                }`}
              />
              {passwordError && (
                <span className="text-red-500 text-xs">{passwordError}</span>
              )}
            </div>
            {/* Show only in Sign Up mode */}
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    className="w-full bg-white border border-amber-500 text-black rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400 transition-colors"
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                  >
                    <option value="player">Player</option>
                    <option value="captain">Captain</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {role === "captain" && (
                  <div className="space-y-2">
                    <Label htmlFor="team">Select Team</Label>
                    {loadingTeams ? (
                      <div className="text-sm text-muted-foreground py-2">
                        Loading teams...
                      </div>
                    ) : teams.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2">
                        No teams available. Please create a team first.
                      </div>
                    ) : (
                      <Select value={teamId} onValueChange={setTeamId}>
                        <SelectTrigger className="w-full bg-white border border-amber-500 text-black">
                          <SelectValue placeholder="Select a team" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((team) => (
                            <SelectItem key={team._id} value={team._id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </>
            )}
            <Button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-primary font-bold"
              size="lg"
            >
              {isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
