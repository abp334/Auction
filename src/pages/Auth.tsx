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

const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{9,}$/;

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [passwordError, setPasswordError] = useState("");

  // ADDED: State for OTP
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");

  // Forced secure password change (first login of auto-provisioned accounts)
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPwdError, setNewPwdError] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, login, signup, verifySignupOtp, completePasswordReset } =
    useAuth();

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
      // Sign Up Flow — only auction organizers (admins) self-register.
      // Captains and players get their logins auto-created by the admin.
      const ok = await signup({
        email,
        password,
        name: email.split("@")[0],
        role: "admin",
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
    const result = await login(email, password);
    if (result.mustChangePassword) {
      // Auto-provisioned account using a temporary password — force a change.
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordChange(true);
      toast({
        title: "Set a New Password",
        description:
          "For security, a verification code was sent to your email. Set a new password to continue.",
      });
      return;
    }
    if (!result.ok) {
      toast({
        title: "Error",
        description: "Invalid credentials or email not verified.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Welcome back!" });
    }
  };

  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewPwdError("");

    if (!otp || otp.length !== 6) {
      toast({
        title: "Error",
        description: "Please enter the valid 6-digit code sent to your email.",
        variant: "destructive",
      });
      return;
    }
    if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
      setNewPwdError(
        "Password must be longer than 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character."
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setNewPwdError("Passwords do not match.");
      return;
    }

    const res = await completePasswordReset(email, otp, newPassword);
    if (res.ok) {
      toast({
        title: "Password Updated",
        description: "Your new password is set. Welcome!",
      });
    } else {
      toast({
        title: "Error",
        description: res.error || "Could not update password.",
        variant: "destructive",
      });
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
            {showPasswordChange
              ? "Secure your account"
              : showOtp
              ? "Verify your email"
              : isLogin
              ? "Sign in to your account"
              : "Create a new account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={
              showPasswordChange
                ? handleCompletePasswordReset
                : showOtp
                ? handleVerifyOtp
                : handleAuth
            }
            className="space-y-4"
          >
            {showPasswordChange ? (
              // FORCED PASSWORD CHANGE FORM (OTP + new strong password)
              <div className="space-y-4">
                <div className="bg-amber-500/10 p-4 rounded text-sm text-amber-500 text-center">
                  A verification code was sent to <strong>{email}</strong>.
                  <br />
                  Enter it and choose a new password.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-otp">Verification Code</Label>
                  <Input
                    id="reset-otp"
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="text-center text-2xl tracking-widest"
                    maxLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="New strong password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={newPwdError ? "border-red-500" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={newPwdError ? "border-red-500" : ""}
                  />
                  {newPwdError && (
                    <span className="text-red-500 text-xs">{newPwdError}</span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  Must be longer than 8 characters with an uppercase, lowercase,
                  number, and special character.
                </div>
              </div>
            ) : !showOtp ? (
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
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
                    Sign up is for auction organizers only. Captains and players
                    receive their logins automatically when an organizer adds
                    them to an auction.
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
              {showPasswordChange
                ? "Update Password & Login"
                : showOtp
                ? "Verify & Login"
                : isLogin
                ? "Sign In"
                : "Sign Up"}
            </Button>
          </form>

          {!showOtp && !showPasswordChange && (
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

          {showPasswordChange && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordChange(false);
                  setPassword("");
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
