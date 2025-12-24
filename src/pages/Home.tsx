import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  Gavel,
  Trophy,
  Users,
  Shield,
  Zap,
  CheckCircle,
  Menu,
  X,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import heroImage from "@/assets/hero-auction.jpg";
import auctionTech from "@/assets/auction-tech.jpg";
import teamCollab from "@/assets/team-collab.jpg";
import logo from "@/assets/logo.png";
const WhatsAppButton = () => (
  <a
    href="https://wa.me/+919925089922" // REPLACE WITH YOUR ACTUAL NUMBER
    target="_blank"
    rel="noopener noreferrer"
    className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#128C7E] text-white p-4 rounded-full shadow-lg transition-all hover:scale-110 flex items-center justify-center animate-in fade-in zoom-in duration-300"
    title="Chat with us on WhatsApp"
  >
    <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  </a>
);

const Home = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background font-sans">
      <WhatsAppButton />

      {/* Navigation */}
      <nav className="border-b bg-primary text-primary-foreground sticky top-0 z-40 backdrop-blur-md bg-primary/95">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2"
              onClick={() => navigate("/")}
              role="button"
            >
              <img
                src={logo}
                alt="ClashBid Logo"
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none"; // Hides if image fails
                }}
              />

              <span className="text-2xl font-bold tracking-tight">
                ClashBid
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <a
                href="#features"
                className="hover:text-amber-500 transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="hover:text-amber-500 transition-colors"
              >
                How It Works
              </a>
              <a
                href="#pricing"
                className="hover:text-amber-500 transition-colors"
              >
                Pricing
              </a>
              <a href="#faq" className="hover:text-amber-500 transition-colors">
                FAQ
              </a>
              <a
                href="/contact"
                className="hover:text-amber-500 transition-colors"
              >
                Contact
              </a>
              <Button
                variant="secondary"
                onClick={() => navigate("/auth")}
                className="font-bold bg-white text-primary hover:bg-gray-100"
              >
                Login / Sign Up
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 space-y-4 pb-4 border-t border-white/10 pt-4">
              <a
                href="#features"
                className="block hover:text-amber-500 transition"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="block hover:text-amber-500 transition"
              >
                How It Works
              </a>
              <a
                href="#pricing"
                className="block hover:text-amber-500 transition"
              >
                Pricing
              </a>
              <a href="#faq" className="block hover:text-amber-500 transition">
                FAQ
              </a>
              <a
                href="/contact"
                className="block hover:text-amber-500 transition"
              >
                Contact Us
              </a>
              <Button
                variant="secondary"
                onClick={() => navigate("/auth")}
                className="w-full font-bold"
              >
                Login / Sign Up
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-[#1a2332] text-white py-24 px-4 overflow-hidden min-h-[80vh] flex items-center">
        <div className="absolute inset-0 opacity-20">
          <img
            src={heroImage}
            alt="Auction celebration"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a2332] via-transparent to-transparent"></div>
        </div>

        <div className="container mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-500 px-4 py-2 rounded-full border border-amber-500/20 text-sm font-bold">
                <Zap className="w-4 h-4 fill-current" />
                <span>Live Cricket Auction Platform</span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-extrabold leading-tight">
                Run Your Auction <br />
                <span className="text-amber-500">Like A Pro</span>
              </h1>
              <p className="text-xl text-gray-300 leading-relaxed max-w-lg">
                The ultimate tool for cricket tournaments. Manage teams, track
                budgets, and conduct thrilling live auctions with real-time
                bidding.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-bold h-14 px-8 text-lg"
                >
                  Start Auction Now
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/contact")}
                  className="border-white/20 hover:bg-white/10 text-black h-14 px-8 text-lg"
                >
                  Contact Sales
                </Button>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute -inset-4 bg-amber-500/20 blur-3xl rounded-full"></div>
              <div className="bg-[#0f1419]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl relative">
                <img
                  src={auctionTech}
                  alt="Auction Dashboard"
                  className="w-full rounded-lg shadow-lg border border-white/5"
                />

                {/* Floating Feature Cards */}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-[#0f1419] py-24 px-4 text-white">
        <div className="container mx-auto">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-gray-400 text-lg">
              Built specifically for local and professional cricket tournaments
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="bg-[#1a2332] border-white/5 hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10">
              <CardContent className="pt-8">
                <div className="bg-amber-500/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <Trophy className="w-7 h-7 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Team Management
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  Full control over team budgets (purse), logos, captain
                  assignments, and squad limits.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#1a2332] border-white/5 hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10">
              <CardContent className="pt-8">
                <div className="bg-blue-500/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <Users className="w-7 h-7 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Player Database
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  Bulk upload players via CSV. Manage base prices, roles
                  (Batsman/Bowler), and photos.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#1a2332] border-white/5 hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10">
              <CardContent className="pt-8">
                <div className="bg-green-500/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <Gavel className="w-7 h-7 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Live Auction Room
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  Real-time synchronization. When an admin starts a timer,
                  captains see it instantly.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#1a2332] border-white/5 hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10">
              <CardContent className="pt-8">
                <div className="bg-purple-500/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <Shield className="w-7 h-7 text-purple-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Secure Roles
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  Admins control the game. Captains can only bid for their own
                  teams. Spectators can only watch.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#1a2332] border-white/5 hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10">
              <CardContent className="pt-8">
                <div className="bg-red-500/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <Zap className="w-7 h-7 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Results Export
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  One-click download of the entire squad list and unsold players
                  as a CSV file after the auction.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#1a2332] border-white/5 hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10">
              <CardContent className="pt-8">
                <div className="bg-orange-500/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <CheckCircle className="w-7 h-7 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Simple Setup
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  No complex configuration. Just upload your lists and start the
                  room code.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="bg-[#1a2332] py-24 px-4 text-white border-t border-white/5"
      >
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <img
                src={teamCollab}
                alt="Team collaboration"
                className="w-full rounded-2xl shadow-2xl border border-white/10"
              />
            </div>
            <div className="space-y-12 order-1 lg:order-2">
              <div>
                <h2 className="text-4xl font-bold mb-4">How It Works</h2>
                <p className="text-gray-400">
                  Get your tournament running in 3 simple steps
                </p>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold text-xl">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Upload Data</h3>
                  <p className="text-gray-400">
                    Admin uploads the list of Players and Teams via CSV/Excel
                    file.
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold text-xl">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Share Room Code</h3>
                  <p className="text-gray-400">
                    Share the unique 6-digit Room Code with all team captains.
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold text-xl">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Start Bidding</h3>
                  <p className="text-gray-400">
                    Admin starts the timer. Captains bid in real-time. Sold
                    players are auto-assigned.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-[#0f1419] py-24 px-4 text-white">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple Pricing</h2>
            <p className="text-gray-400 text-lg">
              Pay per team. No hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Small Tournaments */}
            <Card className="bg-[#1a2332] border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                POPULAR
              </div>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl text-white">
                  Small Tournaments
                </CardTitle>
                <p className="text-gray-400 text-sm">Less than 10 Teams</p>
              </CardHeader>
              <CardContent className="text-center pb-8">
                <div className="flex items-center justify-center gap-1 mb-6">
                  <span className="text-2xl text-gray-400">₹</span>
                  <span className="text-6xl font-bold text-white">200</span>
                  <span className="text-gray-400 self-end mb-2">/team</span>
                </div>
                <div className="space-y-4 mb-8 text-left max-w-xs mx-auto">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <span className="text-gray-300">Unlimited Players</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <span className="text-gray-300">Real-time Bidding</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <span className="text-gray-300">CSV Export</span>
                  </div>
                </div>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 font-bold h-12"
                  onClick={() => navigate("/contact")}
                >
                  Contact to Buy
                </Button>
              </CardContent>
            </Card>

            {/* Large Tournaments */}
            <Card className="bg-[#1a2332] border-amber-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-bl-lg">
                BEST VALUE
              </div>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl text-white">
                  Large Tournaments
                </CardTitle>
                <p className="text-gray-400 text-sm">10 or more Teams</p>
              </CardHeader>
              <CardContent className="text-center pb-8">
                <div className="flex items-center justify-center gap-1 mb-6">
                  <span className="text-2xl text-gray-400">₹</span>
                  <span className="text-6xl font-bold text-amber-500">100</span>
                  <span className="text-gray-400 self-end mb-2">/team</span>
                </div>
                <div className="space-y-4 mb-8 text-left max-w-xs mx-auto">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <span className="text-gray-300">Unlimited Players</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <span className="text-gray-300">Priority Support</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <span className="text-gray-300">
                      Custom Branding Options
                    </span>
                  </div>
                </div>
                <Button
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-12"
                  onClick={() => navigate("/contact")}
                >
                  Contact to Buy
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="bg-[#1a2332] py-24 px-4 text-white border-t border-white/5"
      >
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Common Questions</h2>
          </div>
          <div className="grid gap-6">
            <Card className="bg-[#0f1419] border-white/5">
              <CardContent className="pt-6">
                <h3 className="font-bold text-lg text-white mb-2">
                  How do I start?
                </h3>
                <p className="text-gray-400">
                  Simply sign up as an Admin, upload your players and teams
                  using our CSV template, and you are ready to go.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#0f1419] border-white/5">
              <CardContent className="pt-6">
                <h3 className="font-bold text-lg text-white mb-2">
                  Can captains join remotely?
                </h3>
                <p className="text-gray-400">
                  Yes! Captains can join from anywhere using the Room Code. The
                  bidding is synchronized instantly.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#0f1419] border-white/5">
              <CardContent className="pt-6">
                <h3 className="font-bold text-lg text-white mb-2">
                  Is the data saved?
                </h3>
                <p className="text-gray-400">
                  Yes, but once you finish an auction and download the report,
                  we recommend clearing the data to start fresh for the next
                  tournament.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f1419] border-t border-white/10 py-12 px-4 text-gray-400">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img
              src={logo}
              alt="ClashBid Logo"
              className="w-6 h-6 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />

            <span className="text-xl font-bold text-white">ClashBid</span>
          </div>
          <div className="flex gap-8 text-sm">
            <a href="/contact" className="hover:text-amber-500 transition">
              Contact
            </a>
            <a href="/terms" className="hover:text-amber-500 transition">
              Terms
            </a>
            <a href="/privacy" className="hover:text-amber-500 transition">
              Privacy
            </a>
          </div>
          <div className="text-sm">&copy; 2025 AceBid.</div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
