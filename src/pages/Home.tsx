import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Gavel, Trophy, Users, Clock, Shield, Zap, BarChart3, CheckCircle, Menu, X } from "lucide-react";
import { useState } from "react";
import heroImage from "@/assets/hero-auction.jpg";
import auctionTech from "@/assets/auction-tech.jpg";
import teamCollab from "@/assets/team-collab.jpg";

const Home = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-primary text-primary-foreground sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gavel className="w-8 h-8 text-accent" />
              <span className="text-2xl font-bold">AuctionPro</span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="hover:text-accent transition">Features</a>
              <a href="#how-it-works" className="hover:text-accent transition">How It Works</a>
              <a href="#pricing" className="hover:text-accent transition">Pricing</a>
              <a href="#stats" className="hover:text-accent transition">Stats</a>
              <a href="#faq" className="hover:text-accent transition">FAQ</a>
              <Button variant="secondary" onClick={() => navigate("/auth")}>
                Login / Sign Up
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 space-y-4 pb-4">
              <a href="#features" className="block hover:text-accent transition">Features</a>
              <a href="#how-it-works" className="block hover:text-accent transition">How It Works</a>
              <a href="#pricing" className="block hover:text-accent transition">Pricing</a>
              <a href="#stats" className="block hover:text-accent transition">Stats</a>
              <a href="#faq" className="block hover:text-accent transition">FAQ</a>
              <Button variant="secondary" onClick={() => navigate("/auth")} className="w-full">
                Login / Sign Up
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary to-primary/80 text-primary-foreground py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <img src={heroImage} alt="Auction celebration" className="w-full h-full object-cover" />
        </div>
        <div className="container mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-6xl font-bold mb-6 leading-tight">
                Professional Sports Auction Platform
              </h1>
              <p className="text-xl mb-8 opacity-90">
                Streamline your sports auctions with real-time bidding, team management, and live commentary. 
                Trusted by leagues worldwide for seamless auction experiences.
              </p>
              <div className="flex gap-4">
                <Button size="lg" onClick={() => navigate("/auth")} className="bg-accent hover:bg-accent/90 text-primary font-bold">
                  Start Free Trial
                </Button>
                <Button size="lg" variant="secondary" className="border-2 border-accent">
                  Watch Demo
                </Button>
              </div>
              <div className="flex gap-8 mt-8">
                <div>
                  <div className="text-3xl font-bold text-accent">500+</div>
                  <div className="text-sm opacity-75">Auctions Completed</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-accent">10K+</div>
                  <div className="text-sm opacity-75">Players Auctioned</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-accent">99.9%</div>
                  <div className="text-sm opacity-75">Uptime</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
                <img src={auctionTech} alt="Auction technology" className="w-full h-64 object-cover rounded-xl mb-6" />
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Real-time bidding system</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Multi-team management</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Live auction commentary</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Analytics & reporting</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-background py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Powerful Features for Seamless Auctions</h2>
            <p className="text-muted-foreground text-lg">Everything you need to run professional sports auctions</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-accent/10 w-16 h-16 rounded-lg flex items-center justify-center mb-4">
                  <Trophy className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-2">Team Management</h3>
                <p className="text-muted-foreground">
                  Comprehensive team setup with purse management, captain assignments, and roster tracking
                </p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-accent/10 w-16 h-16 rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-2">Player Database</h3>
                <p className="text-muted-foreground">
                  Organize player information with photos, stats, base prices, and detailed profiles
                </p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-accent/10 w-16 h-16 rounded-lg flex items-center justify-center mb-4">
                  <Gavel className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-2">Live Auction</h3>
                <p className="text-muted-foreground">
                  Real-time bidding with automatic timer, bid tracking, and instant updates
                </p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-accent/10 w-16 h-16 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-2">Role Management</h3>
                <p className="text-muted-foreground">
                  Separate secure interfaces for admins, captains, and spectators with role-based access
                </p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-accent/10 w-16 h-16 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-2">Lightning Fast</h3>
                <p className="text-muted-foreground">
                  Built for speed with optimized performance and instant synchronization
                </p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-accent/10 w-16 h-16 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-2">Analytics</h3>
                <p className="text-muted-foreground">
                  Comprehensive reports and insights on auction performance and bidding patterns
                </p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-accent/10 w-16 h-16 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-2">Scheduled Auctions</h3>
                <p className="text-muted-foreground">
                  Plan and schedule auctions in advance with automated notifications
                </p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-accent/10 w-16 h-16 rounded-lg flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-2">Easy Setup</h3>
                <p className="text-muted-foreground">
                  Get started in minutes with intuitive interface and helpful guides
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-muted/30 py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg">Simple steps to run your auction</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-12">
            <div>
              <img src={teamCollab} alt="Team collaboration" className="w-full rounded-2xl shadow-2xl" />
            </div>
            <div className="grid gap-8">
              <div className="text-center lg:text-left">
                <div className="bg-accent text-accent-foreground w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-4 mx-auto lg:mx-0">
                  1
                </div>
                <h3 className="text-xl font-bold mb-2">Setup</h3>
                <p className="text-muted-foreground">
                  Admin creates teams, adds players, and sets up auction parameters
                </p>
              </div>
              <div className="text-center lg:text-left">
                <div className="bg-accent text-accent-foreground w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-4 mx-auto lg:mx-0">
                  2
                </div>
                <h3 className="text-xl font-bold mb-2">Join</h3>
                <p className="text-muted-foreground">
                  Captains receive room codes and join the live auction session
                </p>
              </div>
              <div className="text-center lg:text-left">
                <div className="bg-accent text-accent-foreground w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-4 mx-auto lg:mx-0">
                  3
                </div>
                <h3 className="text-xl font-bold mb-2">Bid & Win</h3>
                <p className="text-muted-foreground">
                  Real-time bidding with automatic updates and instant player assignments
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-16 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold text-accent mb-2">500+</div>
              <div className="text-lg opacity-90">Successful Auctions</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-accent mb-2">10K+</div>
              <div className="text-lg opacity-90">Players Sold</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-accent mb-2">50+</div>
              <div className="text-lg opacity-90">Leagues Using</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-accent mb-2">99.9%</div>
              <div className="text-lg opacity-90">Platform Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-background py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground text-lg">Choose the plan that fits your needs</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="hover:shadow-xl transition-shadow">
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">Starter</h3>
                  <p className="text-muted-foreground mb-4">Perfect for small leagues</p>
                  <p className="text-5xl font-bold text-accent mb-2">$99</p>
                  <p className="text-sm text-muted-foreground">per auction</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Up to 8 teams</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Up to 50 players</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Real-time bidding</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Email support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Basic analytics</span>
                  </li>
                </ul>
                <Button className="w-full">Start Free Trial</Button>
              </CardContent>
            </Card>
            
            <Card className="border-accent border-2 relative hover:shadow-xl transition-shadow">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground px-4 py-1 rounded-full text-sm font-bold">
                Most Popular
              </div>
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">Professional</h3>
                  <p className="text-muted-foreground mb-4">For serious leagues</p>
                  <p className="text-5xl font-bold text-accent mb-2">$249</p>
                  <p className="text-sm text-muted-foreground">per auction</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Up to 20 teams</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Unlimited players</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>All features included</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Priority support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Advanced analytics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Custom branding</span>
                  </li>
                </ul>
                <Button className="w-full bg-accent hover:bg-accent/90">Start Free Trial</Button>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-xl transition-shadow">
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
                  <p className="text-muted-foreground mb-4">Custom solutions</p>
                  <p className="text-5xl font-bold text-accent mb-2">Custom</p>
                  <p className="text-sm text-muted-foreground">contact us</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Unlimited teams</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Unlimited players</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>White-label solution</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>24/7 dedicated support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>Custom integrations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span>SLA guarantee</span>
                  </li>
                </ul>
                <Button className="w-full" variant="outline">Contact Sales</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-muted/30 py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground text-lg">Everything you need to know</p>
          </div>
          <div className="space-y-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <h3 className="font-bold text-lg mb-3">How does the bidding system work?</h3>
                <p className="text-muted-foreground">
                  Captains can place bids in real-time during the auction. The system automatically tracks bids, manages the timer, and prevents bid conflicts. Each bid increments by a set amount and resets the countdown timer.
                </p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <h3 className="font-bold text-lg mb-3">Can I customize team purses and rules?</h3>
                <p className="text-muted-foreground">
                  Yes, admins have full control over team budgets, bid increments, timer durations, and roster requirements. You can set custom purse amounts for each team and configure auction rules to match your league.
                </p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <h3 className="font-bold text-lg mb-3">What happens if connection is lost?</h3>
                <p className="text-muted-foreground">
                  The system maintains the auction state on the server. Captains can rejoin seamlessly without losing their position, and all bids are preserved. The auction continues uninterrupted for other participants.
                </p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <h3 className="font-bold text-lg mb-3">Can spectators watch the auction?</h3>
                <p className="text-muted-foreground">
                  Absolutely! Players and other stakeholders can join as spectators using the same room code. They'll see live updates, commentary, and team standings without being able to place bids.
                </p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <h3 className="font-bold text-lg mb-3">Is there a limit on auction duration?</h3>
                <p className="text-muted-foreground">
                  No, auctions can run as long as needed. The system is designed to handle both quick drafts and extended multi-day auctions with pause/resume capabilities.
                </p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <h3 className="font-bold text-lg mb-3">Do you offer customer support?</h3>
                <p className="text-muted-foreground">
                  Yes! All plans include email support. Professional and Enterprise plans get priority support with faster response times. Enterprise clients also get dedicated account managers and 24/7 support.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground py-24 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h2 className="text-5xl font-bold mb-6">Ready to Transform Your Auctions?</h2>
          <p className="text-xl mb-10 opacity-90">
            Join 500+ successful leagues already using AuctionPro for their sports auctions
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="bg-accent hover:bg-accent/90 text-lg px-8 py-6">
              Start Free 14-Day Trial
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 bg-white/10 border-white/20 hover:bg-white/20">
              Schedule a Demo
            </Button>
          </div>
          <p className="text-sm opacity-75 mt-6">No credit card required • Cancel anytime • Full support</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Gavel className="w-6 h-6 text-accent" />
                <span className="text-xl font-bold">AuctionPro</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Professional auction platform trusted by leagues worldwide.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-primary transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-primary transition">Pricing</a></li>
                <li><a href="/integrations" className="hover:text-primary transition">Integrations</a></li>
                <li><a href="/api" className="hover:text-primary transition">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/about" className="hover:text-primary transition">About</a></li>
                <li><a href="/blog" className="hover:text-primary transition">Blog</a></li>
                <li><a href="/careers" className="hover:text-primary transition">Careers</a></li>
                <li><a href="/contact" className="hover:text-primary transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/privacy" className="hover:text-primary transition">Privacy</a></li>
                <li><a href="/terms" className="hover:text-primary transition">Terms</a></li>
                <li><a href="/security" className="hover:text-primary transition">Security</a></li>
                <li><a href="/gdpr" className="hover:text-primary transition">GDPR</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 AuctionPro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;