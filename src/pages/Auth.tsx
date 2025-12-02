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
import { useToast } from "@/hooks/use-toast";
import { Gavel } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<"admin" | "player">("player");
  const [passwordError, setPasswordError] = useState("");

  // ADDED: State for OTP
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, login, signup, verifySignupOtp } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === "admin") navigate("/admin");
      else if (user.role === "captain") navigate("/captain");
      else navigate("/player");
    }
  }, [user, navigate]);

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
      return;
    }

    if (!isLogin) {
      // Sign Up Flow
      const ok = await signup({
        email,
        password,
        name: email.split("@")[0],
        role,
      });

      if (ok) {
        toast({
          title: "Verification Sent",
          description: "Check your email (or server console) for the OTP.",
        });
        setShowOtp(true); // Switch UI to show OTP input
      } else {
        toast({
          title: "Error",
          description: "Signup failed or email already exists.",
          variant: "destructive",
        });
      }
      return;
    }

    // Login Flow
    const ok = await login(email, password);
    if (!ok) {
      toast({
        title: "Error",
        description: "Invalid credentials or email not verified.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Welcome back!" });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast({
        title: "Error",
        description: "Please enter a valid 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    const ok = await verifySignupOtp(email, otp);
    if (ok) {
      toast({
        title: "Verified!",
        description: "Account created successfully.",
      });
    } else {
      toast({
        title: "Error",
        description: "Invalid OTP.",
        variant: "destructive",
      });
    }
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
            {showOtp
              ? "Verify your email"
              : isLogin
              ? "Sign in to your account"
              : "Create a new account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={showOtp ? handleVerifyOtp : handleAuth}
            className="space-y-4"
          >
            {!showOtp ? (
              // NORMAL LOGIN/SIGNUP FORM
              <>
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
                    className={passwordError ? "border-red-500" : ""}
                  />
                  {passwordError && (
                    <span className="text-red-500 text-xs">
                      {passwordError}
                    </span>
                  )}
                </div>

                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <select
                      id="role"
                      className="w-full bg-white border border-amber-500 text-black rounded-lg px-3 py-2"
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                    >
                      <option value="player">Player</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                )}
              </>
            ) : (
              // OTP VERIFICATION FORM
              <div className="space-y-4">
                <div className="bg-amber-500/10 p-4 rounded text-sm text-amber-500 text-center">
                  We've sent a verification code to <strong>{email}</strong>.
                  <br />
                  (Check your server console if running locally)
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="text-center text-2xl tracking-widest"
                    maxLength={6}
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-primary font-bold"
              size="lg"
            >
              {showOtp ? "Verify & Login" : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>

          {!showOtp && (
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
          )}

          {showOtp && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowOtp(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Back to Signup
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
