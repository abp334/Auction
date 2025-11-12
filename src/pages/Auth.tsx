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
  // Signup will only create player accounts from the UI.
  // Admins can promote users to captains from the admin dashboard.
  const [teamId, setTeamId] = useState("");
  const [teams, setTeams] = useState<Array<{ _id: string; name: string }>>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, login, signup, verifySignupOtp } = useAuth();
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === "admin") navigate("/admin");
      else if (user.role === "captain") navigate("/captain");
      else navigate("/player");
    }
  }, [user, navigate]);

  // Load teams only when in signup mode (used for optional team selection by admin later)
  useEffect(() => {
    if (!isLogin) {
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
  }, [isLogin]);

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
    if (!isLogin) {
      // Sign up flow: create account and trigger OTP email
      const ok = await signup({
        email,
        password,
        name: email.split("@")[0],
      });
      if (!ok) {
        toast({
          title: "Error",
          description: "Failed to start signup. Try again.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "OTP Sent",
        description: "Check your email for the verification code.",
      });
      setShowOtp(true);
      return;
    }

    // Login flow
    const ok = await login(email, password);
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp) {
      toast({
        title: "Error",
        description: "Please provide email and OTP",
        variant: "destructive",
      });
      return;
    }
    const ok = await verifySignupOtp(email, otp);
    if (!ok) {
      toast({
        title: "Error",
        description: "Invalid OTP",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Success", description: "Email verified. Welcome!" });
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
          <form
            onSubmit={showOtp ? handleVerifyOtp : handleAuth}
            className="space-y-4"
          >
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
            {/* Show OTP verify input after signup */}
            {!isLogin && showOtp && (
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
                <div className="text-sm text-gray-400">
                  We sent a 6-digit code to your email. It expires in 10
                  minutes.
                </div>
              </div>
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
