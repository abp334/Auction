import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

const Terms = () => {
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
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="bg-amber-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-amber-500">
              <FileText className="w-10 h-10 text-amber-500" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">Terms of Service</h1>
            <p className="text-gray-400">Last updated: January 2025</p>
          </div>

          <Card className="bg-[#1a2332] border-amber-500/30 mb-6">
            <CardContent className="pt-6 text-gray-300 space-y-6">
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
                <p>
                  By accessing and using AuctionPro, you accept and agree to be bound by the terms and provision of
                  this agreement. If you do not agree to these terms, please do not use our service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">2. Use License</h2>
                <p className="mb-3">
                  Permission is granted to temporarily access AuctionPro for personal or commercial auction purposes.
                  This is the grant of a license, not a transfer of title, and under this license you may not:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Modify or copy the materials</li>
                  <li>Use the materials for any commercial purpose without authorization</li>
                  <li>Attempt to decompile or reverse engineer any software</li>
                  <li>Remove any copyright or proprietary notations</li>
                  <li>Transfer the materials to another person or entity</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">3. User Accounts</h2>
                <p className="mb-3">When you create an account with us, you must provide accurate and complete information. You are responsible for:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Maintaining the security of your account credentials</li>
                  <li>All activities that occur under your account</li>
                  <li>Notifying us immediately of any unauthorized use</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">4. Payment Terms</h2>
                <p>
                  Subscription fees are billed in advance on a per-auction basis. All fees are non-refundable except
                  as expressly stated in our refund policy. We reserve the right to change our pricing with 30 days
                  notice.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">5. Acceptable Use</h2>
                <p className="mb-3">You agree not to use AuctionPro to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Violate any laws or regulations</li>
                  <li>Infringe on intellectual property rights</li>
                  <li>Transmit harmful code or malware</li>
                  <li>Harass or harm other users</li>
                  <li>Interfere with the proper functioning of the service</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">6. Service Availability</h2>
                <p>
                  While we strive for 99.9% uptime, we do not guarantee uninterrupted access to our services. We may
                  modify, suspend, or discontinue any aspect of the service at any time with reasonable notice.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">7. Intellectual Property</h2>
                <p>
                  The service and its original content, features, and functionality are owned by AuctionPro and are
                  protected by international copyright, trademark, and other intellectual property laws.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">8. Limitation of Liability</h2>
                <p>
                  AuctionPro shall not be liable for any indirect, incidental, special, consequential, or punitive
                  damages resulting from your use or inability to use the service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">9. Termination</h2>
                <p>
                  We may terminate or suspend your account immediately, without prior notice, for conduct that we
                  believe violates these Terms of Service or is harmful to other users, us, or third parties.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">10. Contact Information</h2>
                <p>
                  Questions about the Terms of Service should be sent to:
                </p>
                <p className="mt-2">
                  Email: <span className="text-amber-500">legal@auctionpro.com</span><br />
                  Address: 123 Tech Street, San Francisco, CA 94105
                </p>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Terms;
