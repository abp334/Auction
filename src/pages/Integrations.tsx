import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plug, CheckCircle } from "lucide-react";

const Integrations = () => {
  const navigate = useNavigate();

  const integrations = [
    {
      name: "Slack",
      description: "Get real-time auction notifications and updates in your team's Slack channels",
      features: ["Bid alerts", "Player sold notifications", "Auction status updates"]
    },
    {
      name: "Zapier",
      description: "Connect AuctionPro with 5000+ apps to automate your workflows",
      features: ["Custom triggers", "Multi-step workflows", "Data synchronization"]
    },
    {
      name: "Google Sheets",
      description: "Export auction data and reports directly to Google Sheets for analysis",
      features: ["Auto-sync results", "Custom templates", "Real-time updates"]
    },
    {
      name: "Microsoft Teams",
      description: "Collaborate with your team and get auction updates in Microsoft Teams",
      features: ["Channel notifications", "Team mentions", "Status updates"]
    },
    {
      name: "Webhooks",
      description: "Build custom integrations using our powerful webhook system",
      features: ["Real-time events", "Custom endpoints", "Payload customization"]
    },
    {
      name: "Payment Gateways",
      description: "Accept payments securely with integrated payment processing",
      features: ["Stripe integration", "PayPal support", "Automatic invoicing"]
    }
  ];

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
              <Plug className="w-10 h-10 text-amber-500" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">Integrations</h1>
            <p className="text-xl text-gray-300">
              Connect AuctionPro with your favorite tools
            </p>
          </div>

          <Card className="bg-[#1a2332] border-amber-500/30 mb-12">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-white mb-4">Seamless Connections</h2>
              <p className="text-gray-300">
                AuctionPro integrates with the tools you already use, making it easy to incorporate auction
                management into your existing workflows. From notifications to data exports, our integrations
                help you work more efficiently.
              </p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {integrations.map((integration, index) => (
              <Card key={index} className="bg-[#1a2332] border-amber-500/30 hover:border-amber-500 transition-all">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold text-white mb-3">{integration.name}</h3>
                  <p className="text-gray-300 mb-4">{integration.description}</p>
                  <ul className="space-y-2">
                    {integration.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-400 text-sm">
                        <CheckCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-amber-500/10 border-amber-500/30 text-center">
            <CardContent className="pt-6">
              <h3 className="text-2xl font-bold text-white mb-4">Need a Custom Integration?</h3>
              <p className="text-gray-300 mb-6">
                Our API makes it easy to build custom integrations. Enterprise customers can also request
                dedicated integration support from our team.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => navigate("/api")}
                  className="bg-amber-500 hover:bg-amber-600 text-primary font-bold"
                >
                  View API Docs
                </Button>
                <Button
                  onClick={() => navigate("/contact")}
                  variant="outline"
                  className="border-amber-500/30 text-white hover:bg-amber-500/10"
                >
                  Contact Sales
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Integrations;
