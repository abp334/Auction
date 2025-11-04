import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

const GDPR = () => {
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
            <h1 className="text-5xl font-bold text-white mb-4">GDPR Compliance</h1>
            <p className="text-gray-400">General Data Protection Regulation</p>
          </div>

          <Card className="bg-[#1a2332] border-amber-500/30 mb-6">
            <CardContent className="pt-6 text-gray-300 space-y-6">
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Our Commitment to GDPR</h2>
                <p>
                  AuctionPro is fully committed to complying with the General Data Protection Regulation (GDPR) and
                  respecting the privacy rights of individuals in the European Economic Area (EEA). This page outlines
                  how we meet GDPR requirements and protect your personal data.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Your Rights Under GDPR</h2>
                <p className="mb-3">As a data subject, you have the following rights:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong className="text-white">Right to Access:</strong> Request access to your personal data and obtain a copy</li>
                  <li><strong className="text-white">Right to Rectification:</strong> Request correction of inaccurate or incomplete data</li>
                  <li><strong className="text-white">Right to Erasure:</strong> Request deletion of your personal data (right to be forgotten)</li>
                  <li><strong className="text-white">Right to Restriction:</strong> Request limitation of processing your personal data</li>
                  <li><strong className="text-white">Right to Portability:</strong> Receive your data in a structured, machine-readable format</li>
                  <li><strong className="text-white">Right to Object:</strong> Object to processing of your personal data for specific purposes</li>
                  <li><strong className="text-white">Right to Withdraw Consent:</strong> Withdraw consent at any time where processing is based on consent</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Lawful Basis for Processing</h2>
                <p className="mb-3">We process personal data under the following lawful bases:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong className="text-white">Contract Performance:</strong> To provide our auction services to you</li>
                  <li><strong className="text-white">Legitimate Interests:</strong> To improve our services and prevent fraud</li>
                  <li><strong className="text-white">Legal Obligation:</strong> To comply with legal requirements</li>
                  <li><strong className="text-white">Consent:</strong> Where you have given explicit consent for specific purposes</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Data Protection Measures</h2>
                <p className="mb-3">We implement appropriate technical and organizational measures including:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Regular security assessments and audits</li>
                  <li>Staff training on data protection</li>
                  <li>Access controls and authentication measures</li>
                  <li>Data breach notification procedures</li>
                  <li>Data Protection Impact Assessments (DPIAs) for high-risk processing</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">International Data Transfers</h2>
                <p>
                  When we transfer personal data outside the EEA, we ensure appropriate safeguards are in place,
                  including Standard Contractual Clauses (SCCs) approved by the European Commission, and compliance
                  with adequacy decisions where applicable.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Data Retention</h2>
                <p>
                  We retain personal data only for as long as necessary to fulfill the purposes for which it was
                  collected, including legal, accounting, or reporting requirements. Retention periods vary depending
                  on the type of data and the purpose of processing.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Exercising Your Rights</h2>
                <p className="mb-3">
                  To exercise any of your GDPR rights, please contact our Data Protection Officer:
                </p>
                <p className="mt-2">
                  Email: <span className="text-amber-500">dpo@auctionpro.com</span><br />
                  Address: Data Protection Officer, 123 Tech Street, San Francisco, CA 94105
                </p>
                <p className="mt-4">
                  We will respond to your request within one month of receipt. If your request is complex or we receive
                  multiple requests, we may extend this period by two months, and we will inform you of any such extension.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Right to Lodge a Complaint</h2>
                <p>
                  If you believe we have not processed your personal data in accordance with GDPR, you have the right
                  to lodge a complaint with your local supervisory authority. Contact details for supervisory authorities
                  in the EEA can be found on the European Data Protection Board website.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Updates to This Policy</h2>
                <p>
                  We may update this GDPR compliance statement from time to time. We will notify you of any material
                  changes by posting the new statement on this page and updating the "last updated" date.
                </p>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default GDPR;
