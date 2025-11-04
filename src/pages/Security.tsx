import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Database, Eye, CheckCircle } from "lucide-react";

const Security = () => {
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
              <Shield className="w-10 h-10 text-amber-500" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">Security</h1>
            <p className="text-xl text-gray-300">
              Your data security is our top priority
            </p>
          </div>

          <Card className="bg-[#1a2332] border-amber-500/30 mb-8">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-white mb-4">Our Commitment</h2>
              <p className="text-gray-300 mb-4">
                At AuctionPro, we understand that you're trusting us with sensitive auction data and personal
                information. We take this responsibility seriously and have implemented enterprise-grade security
                measures to protect your data at every level.
              </p>
              <p className="text-gray-300">
                Our security infrastructure is continuously monitored, regularly audited, and updated to defend
                against emerging threats.
              </p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card className="bg-[#1a2332] border-amber-500/30">
              <CardContent className="pt-6">
                <div className="bg-amber-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Encryption</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    TLS 1.3 for data in transit
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    AES-256 encryption at rest
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    End-to-end encrypted communications
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-[#1a2332] border-amber-500/30">
              <CardContent className="pt-6">
                <div className="bg-amber-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Database className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Data Protection</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    Daily automated backups
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    Geo-redundant storage
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    Point-in-time recovery
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-[#1a2332] border-amber-500/30">
              <CardContent className="pt-6">
                <div className="bg-amber-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Eye className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Monitoring</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    24/7 security monitoring
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    Intrusion detection systems
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    Real-time threat analysis
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-[#1a2332] border-amber-500/30">
              <CardContent className="pt-6">
                <div className="bg-amber-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Shield className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Compliance</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    SOC 2 Type II certified
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    GDPR compliant
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    Regular security audits
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-[#1a2332] border-amber-500/30 mb-8">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-white mb-4">Infrastructure Security</h2>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Cloud Infrastructure:</strong> Hosted on enterprise-grade cloud
                    platforms with multiple availability zones for redundancy
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Access Control:</strong> Multi-factor authentication, role-based
                    access control, and least privilege principles
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Network Security:</strong> Firewalls, DDoS protection, and network
                    segmentation to isolate critical systems
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Application Security:</strong> Regular penetration testing,
                    vulnerability scanning, and secure code reviews
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-amber-500/10 border-amber-500/30 text-center">
            <CardContent className="pt-6">
              <h3 className="text-2xl font-bold text-white mb-4">Security Questions?</h3>
              <p className="text-gray-300 mb-6">
                Our security team is here to answer any questions about our practices and certifications.
              </p>
              <Button
                onClick={() => navigate("/contact")}
                className="bg-amber-500 hover:bg-amber-600 text-primary font-bold"
              >
                Contact Security Team
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Security;
