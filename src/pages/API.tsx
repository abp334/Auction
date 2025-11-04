import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Code, Book, Zap, Shield } from "lucide-react";

const API = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#0f1419]">
      <header className="border-b border-amber-500/30 bg-[#0f1419]/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-white hover:text-amber-500"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="bg-amber-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-amber-500">
              <Code className="w-10 h-10 text-amber-500" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">AuctionPro API</h1>
            <p className="text-xl text-gray-300">
              Build powerful integrations with our RESTful API
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="bg-[#1a2332] border-amber-500/30 text-center">
              <CardContent className="pt-6">
                <div className="bg-amber-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Fast & Reliable</h3>
                <p className="text-gray-300">
                  99.9% uptime with response times under 100ms
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#1a2332] border-amber-500/30 text-center">
              <CardContent className="pt-6">
                <div className="bg-amber-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Secure</h3>
                <p className="text-gray-300">
                  OAuth 2.0 authentication with API key support
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#1a2332] border-amber-500/30 text-center">
              <CardContent className="pt-6">
                <div className="bg-amber-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Book className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Well Documented</h3>
                <p className="text-gray-300">
                  Comprehensive docs with code examples
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-[#1a2332] border-amber-500/30 mb-8">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-white mb-4">API Features</h2>
              <div className="grid md:grid-cols-2 gap-6 text-gray-300">
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Core Resources</h3>
                  <ul className="space-y-2">
                    <li>• Teams management</li>
                    <li>• Player CRUD operations</li>
                    <li>• Auction creation and control</li>
                    <li>• Real-time bid tracking</li>
                    <li>• Room code generation</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Advanced Features</h3>
                  <ul className="space-y-2">
                    <li>• Webhooks for events</li>
                    <li>• Bulk operations support</li>
                    <li>• Analytics endpoints</li>
                    <li>• Export capabilities</li>
                    <li>• Custom integrations</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0f1419] border-amber-500/30 mb-8">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-white mb-4">Quick Start Example</h2>
              <div className="bg-[#1a2332] p-4 rounded-lg font-mono text-sm text-gray-300 overflow-x-auto">
                <pre>{`// Initialize the API client
const auctionPro = new AuctionProAPI({
  apiKey: 'your_api_key_here',
  baseURL: 'https://api.auctionpro.com/v1'
});

// Create a new auction
const auction = await auctionPro.auctions.create({
  name: 'Summer League 2025',
  teams: ['team_1', 'team_2', 'team_3'],
  players: ['player_1', 'player_2'],
  settings: {
    bidIncrement: 5000,
    timerDuration: 30
  }
});

// Start the auction
await auctionPro.auctions.start(auction.id);

// Listen for bid events
auctionPro.on('bid.placed', (data) => {
  console.log(\`New bid: \${data.amount} by \${data.teamName}\`);
});`}</pre>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a2332] border-amber-500/30 mb-8">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-white mb-4">Rate Limits</h2>
              <div className="space-y-4 text-gray-300">
                <div className="flex justify-between items-center p-3 bg-[#0f1419] rounded">
                  <span>Starter Plan</span>
                  <span className="text-amber-500 font-bold">1,000 requests/hour</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#0f1419] rounded">
                  <span>Professional Plan</span>
                  <span className="text-amber-500 font-bold">10,000 requests/hour</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#0f1419] rounded">
                  <span>Enterprise Plan</span>
                  <span className="text-amber-500 font-bold">Custom limits</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-500/10 border-amber-500/30 text-center">
            <CardContent className="pt-6">
              <h3 className="text-2xl font-bold text-white mb-4">Ready to Get Started?</h3>
              <p className="text-gray-300 mb-6">
                Generate your API keys and access full documentation to start building.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  className="bg-amber-500 hover:bg-amber-600 text-primary font-bold"
                >
                  Get API Keys
                </Button>
                <Button
                  variant="outline"
                  className="border-amber-500/30 text-white hover:bg-amber-500/10"
                >
                  View Full Documentation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default API;
