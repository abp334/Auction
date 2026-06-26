import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

const CONTACT_EMAIL = "subscription.clashbid@gmail.com";
const LEGAL_LAST_UPDATED = "26 June 2025";

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
            <h1 className="text-5xl font-bold text-white mb-4">
              Terms of Service
            </h1>
            <p className="text-gray-400">Last updated: {LEGAL_LAST_UPDATED}</p>
          </div>

          <Card className="bg-[#1a2332] border-amber-500/30 mb-6">
            <CardContent className="pt-6 text-gray-300 space-y-8 leading-relaxed">
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  1. Agreement to Terms
                </h2>
                <p>
                  These Terms of Service (&quot;Terms&quot;) govern access to and use of
                  the ClashBid platform, including the website at{" "}
                  <span className="text-amber-400">clashbid.live</span>, related
                  applications, APIs, and live auction services (collectively, the
                  &quot;Service&quot;). The Service is operated by ClashBid
                  (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), with operations
                  based in Ahmedabad, Gujarat, India.
                </p>
                <p className="mt-3">
                  By creating an account, joining an auction room, or otherwise using
                  the Service, you agree to these Terms and our{" "}
                  <Link to="/privacy" className="text-amber-400 hover:underline">
                    Privacy Policy
                  </Link>
                  . If you do not agree, you must not use the Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  2. Description of Service
                </h2>
                <p>
                  ClashBid is a software-as-a-service (SaaS) platform for conducting
                  live player auctions—primarily for sports leagues, fantasy
                  tournaments, and similar events. Organisers (&quot;Admins&quot;) can
                  create auction rooms, import teams and players, and run real-time
                  bidding. Captains and players may participate using credentials
                  provisioned for a specific auction event.
                </p>
                <p className="mt-3">
                  We provide the technology platform only. We do not organise auctions,
                  verify player eligibility, enforce league rules, or guarantee the
                  outcome of any bid or sale. The Admin of each auction is responsible
                  for the conduct and legality of that event.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  3. Eligibility
                </h2>
                <p>
                  You must be at least 18 years of age and capable of entering into a
                  binding contract under the Indian Contract Act, 1872. By using the
                  Service, you represent that you meet this requirement. If you use the
                  Service on behalf of an organisation, you confirm that you have
                  authority to bind that organisation to these Terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  4. Accounts and Access
                </h2>
                <p className="mb-3">
                  Access to certain features requires registration. You agree to:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    Provide accurate, current, and complete registration information
                  </li>
                  <li>
                    Maintain the confidentiality of your login credentials and not
                    share them with unauthorised persons
                  </li>
                  <li>
                    Accept responsibility for all activity under your account
                  </li>
                  <li>
                    Notify us promptly at{" "}
                    <a
                      href={`mailto:${CONTACT_EMAIL}`}
                      className="text-amber-400 hover:underline"
                    >
                      {CONTACT_EMAIL}
                    </a>{" "}
                    if you suspect unauthorised access
                  </li>
                </ul>
                <p className="mt-3">
                  Admin accounts may require a valid invite code issued by ClashBid.
                  Captain and player accounts are typically created by an Admin for a
                  specific auction and may be deactivated when that auction ends.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  5. Subscriptions and Fees
                </h2>
                <p>
                  Paid access to the Service is offered on a subscription or
                  per-auction basis, as communicated at the time of purchase. Unless
                  stated otherwise in writing, all fees are quoted and payable in
                  Indian Rupees (INR). Fees are generally non-refundable once an
                  auction room has been activated or access has been granted, except
                  where required under applicable law, including the Consumer
                  Protection Act, 2019.
                </p>
                <p className="mt-3">
                  We may revise pricing or plan features with reasonable prior notice.
                  Continued use after a price change constitutes acceptance of the
                  updated fees for subsequent billing periods.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  6. Acceptable Use
                </h2>
                <p className="mb-3">You must not use the Service to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    Violate any applicable law, regulation, or third-party rights
                  </li>
                  <li>
                    Upload false, misleading, or unlawful auction or player data
                  </li>
                  <li>
                    Attempt to gain unauthorised access to accounts, rooms, or systems
                  </li>
                  <li>
                    Interfere with live bidding, timers, or platform integrity
                    (including automated scripts, bots, or denial-of-service activity)
                  </li>
                  <li>
                    Reverse engineer, scrape, or resell the Service except as expressly
                    permitted
                  </li>
                  <li>
                    Harass, abuse, or harm other users or ClashBid personnel
                  </li>
                </ul>
                <p className="mt-3">
                  We may investigate violations and cooperate with law enforcement where
                  required.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  7. User Content and Auction Data
                </h2>
                <p>
                  You retain ownership of data you submit (team names, player details,
                  photos, bid records, etc.). You grant ClashBid a limited, worldwide,
                  non-exclusive licence to host, process, display, and transmit that
                  content solely to operate and improve the Service for your auction.
                </p>
                <p className="mt-3">
                  You are solely responsible for ensuring that you have the right to
                  upload all content, including player photographs and personal
                  information, and for obtaining any consents required under the
                  Digital Personal Data Protection Act, 2023 (DPDP Act) or other
                  applicable law.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  8. Intellectual Property
                </h2>
                <p>
                  The ClashBid name, logo, software, user interface, documentation, and
                  all related intellectual property are owned by ClashBid or its
                  licensors. These Terms do not grant you any rights to our trademarks
                  or branding except as needed to use the Service in the ordinary course.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  9. Service Availability
                </h2>
                <p>
                  We aim to keep the Service available during live auctions but do not
                  guarantee uninterrupted or error-free operation. Maintenance, network
                  issues, third-party outages, or force majeure events may cause
                  downtime. We will use reasonable efforts to restore service and, where
                  practicable, provide advance notice of scheduled maintenance.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  10. Disclaimer of Warranties
                </h2>
                <p>
                  The Service is provided on an &quot;as is&quot; and &quot;as
                  available&quot; basis to the fullest extent permitted by law. We
                  disclaim all warranties, express or implied, including fitness for a
                  particular purpose and non-infringement. We do not warrant that bid
                  amounts, purse calculations, or roster assignments will be free from
                  error; Admins should review results before treating them as final.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  11. Limitation of Liability
                </h2>
                <p>
                  To the maximum extent permitted under Indian law, ClashBid and its
                  directors, employees, and affiliates shall not be liable for any
                  indirect, incidental, special, consequential, or punitive damages,
                  or for loss of profits, data, goodwill, or business opportunity,
                  arising from your use of the Service.
                </p>
                <p className="mt-3">
                  Our aggregate liability for any claim relating to the Service shall
                  not exceed the amount you paid to ClashBid for the specific auction
                  or subscription period giving rise to the claim during the twelve (12)
                  months preceding the event, or INR 10,000, whichever is greater,
                  except where liability cannot be limited by law.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  12. Indemnity
                </h2>
                <p>
                  You agree to indemnify and hold harmless ClashBid from claims, losses,
                  and expenses (including reasonable legal fees) arising from your use
                  of the Service, your auction content, your breach of these Terms, or
                  your violation of any law or third-party rights.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  13. Termination
                </h2>
                <p>
                  You may stop using the Service at any time. We may suspend or
                  terminate your access immediately if you breach these Terms, if
                  required by law, or if continued access poses a security or legal
                  risk. Upon termination, your right to use the Service ceases; provisions
                  that by nature should survive (including liability limits and governing
                  law) will remain in effect.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  14. Governing Law and Disputes
                </h2>
                <p>
                  These Terms are governed by the laws of India. Subject to applicable
                  consumer protection laws, the courts at Ahmedabad, Gujarat shall have
                  exclusive jurisdiction over disputes arising out of or relating to
                  these Terms or the Service.
                </p>
                <p className="mt-3">
                  Before initiating formal proceedings, we encourage you to contact us
                  at{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-amber-400 hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>{" "}
                  so we can attempt to resolve the matter in good faith.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  15. Changes to These Terms
                </h2>
                <p>
                  We may update these Terms from time to time. We will post the revised
                  version on this page and update the &quot;Last updated&quot; date.
                  Material changes may also be communicated by email or in-app notice
                  where appropriate. Continued use after changes take effect constitutes
                  acceptance of the revised Terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  16. Contact
                </h2>
                <p>For questions about these Terms, contact:</p>
                <p className="mt-3">
                  <span className="text-white font-medium">ClashBid</span>
                  <br />
                  Ahmedabad, Gujarat, India
                  <br />
                  Email:{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-amber-400 hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
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
