import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

const CONTACT_EMAIL = "subscription.clashbid@gmail.com";
const PRIVACY_LAST_UPDATED = "26 June 2025";

const Privacy = () => {
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
            <h1 className="text-5xl font-bold text-white mb-4">Privacy Policy</h1>
            <p className="text-gray-400">Last updated: {PRIVACY_LAST_UPDATED}</p>
          </div>

          <Card className="bg-[#1a2332] border-amber-500/30 mb-6">
            <CardContent className="pt-6 text-gray-300 space-y-8 leading-relaxed">
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  1. Introduction
                </h2>
                <p>
                  ClashBid (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) respects
                  your privacy and is committed to handling personal data responsibly.
                  This Privacy Policy explains how we collect, use, store, share, and
                  protect personal information when you use our website, applications,
                  and live auction platform at{" "}
                  <span className="text-amber-400">clashbid.live</span> (the
                  &quot;Service&quot;).
                </p>
                <p className="mt-3">
                  We process personal data in accordance with applicable Indian law,
                  including the Information Technology Act, 2000, the Information
                  Technology (Reasonable Security Practices and Procedures and Sensitive
                  Personal Data or Information) Rules, 2011, and the Digital Personal
                  Data Protection Act, 2023 (&quot;DPDP Act&quot;), as and when
                  applicable to our operations.
                </p>
                <p className="mt-3">
                  By using the Service, you acknowledge this Privacy Policy. Please also
                  read our{" "}
                  <Link to="/terms" className="text-amber-400 hover:underline">
                    Terms of Service
                  </Link>
                  .
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  2. Data Fiduciary
                </h2>
                <p>
                  For the purposes of the DPDP Act, ClashBid acts as the Data Fiduciary
                  for personal data collected through the Service. Our contact details
                  are set out in Section 14 below.
                </p>
                <p className="mt-3">
                  When an Admin uploads player or team information for an auction, the
                  Admin may also act as a Data Fiduciary or Data Processor with respect
                  to that event data. Admins are responsible for informing participants
                  and obtaining lawful grounds for processing as required.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  3. Information We Collect
                </h2>
                <p className="mb-3">
                  Depending on how you use the Service, we may collect:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <span className="text-white">Account data:</span> name, email
                    address, password (stored in hashed form), role (admin, captain, or
                    player), and verification status
                  </li>
                  <li>
                    <span className="text-white">Auction data:</span> team names, player
                    names, roles, base prices, photos, mobile numbers, emails, bid
                    history, sale records, and room activity
                  </li>
                  <li>
                    <span className="text-white">Technical data:</span> IP address,
                    browser type, device information, access timestamps, and logs
                    generated for security and debugging
                  </li>
                  <li>
                    <span className="text-white">Communications:</span> messages you send
                    via our contact form, support requests, and email correspondence
                  </li>
                  <li>
                    <span className="text-white">Payment-related data:</span> billing
                    contact details and transaction references (payment card details are
                    processed by third-party payment providers and not stored by us)
                  </li>
                </ul>
                <p className="mt-3">
                  We do not intentionally collect sensitive personal data such as
                  financial account passwords, biometric data, or health information
                  unless you voluntarily include it in free-text fields—which we
                  discourage.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  4. How We Use Your Information
                </h2>
                <p className="mb-3">We use personal data to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Create and manage user accounts and auction rooms</li>
                  <li>
                    Enable live bidding, roster management, and real-time updates
                  </li>
                  <li>Authenticate users and send OTP or service-related emails</li>
                  <li>Process subscriptions and respond to enquiries</li>
                  <li>
                    Monitor, secure, and improve platform performance and reliability
                  </li>
                  <li>Comply with legal obligations and enforce our Terms of Service</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  5. Legal Basis for Processing
                </h2>
                <p className="mb-3">We process personal data on the basis of:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <span className="text-white">Consent:</span> where you register,
                    verify your email, or submit a contact form
                  </li>
                  <li>
                    <span className="text-white">Performance of a contract:</span> to
                    provide the Service you or your Admin have subscribed to
                  </li>
                  <li>
                    <span className="text-white">Legitimate uses:</span> security,
                    fraud prevention, analytics, and service improvement, where not
                    overridden by your rights
                  </li>
                  <li>
                    <span className="text-white">Legal obligation:</span> where required
                    by Indian law or valid government authority
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  6. How We Share Information
                </h2>
                <p className="mb-3">
                  We do not sell your personal data. We may share information only as
                  follows:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <span className="text-white">Within an auction:</span> Admins,
                    captains, and authorised participants may see data relevant to that
                    event (e.g., player names, bids, team purses)
                  </li>
                  <li>
                    <span className="text-white">Service providers:</span> hosting,
                    database, email delivery, analytics, and infrastructure partners
                    who process data on our instructions and under confidentiality
                    obligations (including providers such as cloud hosting and email
                    delivery services)
                  </li>
                  <li>
                    <span className="text-white">Legal requirements:</span> when required
                    by law, court order, or to protect rights, safety, and security
                  </li>
                  <li>
                    <span className="text-white">Business transfers:</span> in connection
                    with a merger, acquisition, or sale of assets, with notice where
                    required by law
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  7. Cross-Border Processing
                </h2>
                <p>
                  Our infrastructure providers may store or process data on servers
                  located outside India. Where personal data is transferred abroad, we
                  take reasonable steps to ensure that recipients provide appropriate
                  protections consistent with applicable Indian data protection
                  requirements, including contractual safeguards where required.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  8. Data Security
                </h2>
                <p>
                  We implement reasonable administrative, technical, and organisational
                  measures to protect personal data, including encrypted connections
                  (HTTPS), hashed passwords, access controls, and secure cloud
                  infrastructure. No method of transmission or storage is completely
                  secure; we cannot guarantee absolute security.
                </p>
                <p className="mt-3">
                  You are responsible for keeping your login credentials confidential
                  and using a strong, unique password.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  9. Data Retention
                </h2>
                <p>
                  We retain personal data for as long as your account is active or as
                  needed to provide the Service. Auction-related data may be deleted
                  when an Admin closes an auction, subject to backup retention for a
                  limited period. We may retain certain records longer where required
                  for legal, tax, audit, or dispute-resolution purposes.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  10. Your Rights
                </h2>
                <p className="mb-3">
                  Subject to applicable law, including the DPDP Act, you may have the
                  right to:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Access personal data we hold about you</li>
                  <li>Request correction of inaccurate or incomplete data</li>
                  <li>
                    Request erasure of personal data, subject to legal retention
                    requirements
                  </li>
                  <li>Withdraw consent where processing is consent-based</li>
                  <li>
                    Nominate an individual to exercise your rights in the event of death
                    or incapacity, as permitted under the DPDP Act
                  </li>
                  <li>
                    Lodge a complaint with the Data Protection Board of India once
                    operational, or seek redress through our grievance process below
                  </li>
                </ul>
                <p className="mt-3">
                  To exercise these rights, email{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-amber-400 hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
                  . We may verify your identity before responding.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  11. Cookies and Similar Technologies
                </h2>
                <p>
                  We use essential cookies and local storage to maintain login sessions,
                  security tokens, and user preferences. We do not use cookies for
                  third-party advertising. You can control cookies through your browser
                  settings; disabling essential cookies may affect Service functionality.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  12. Children&apos;s Privacy
                </h2>
                <p>
                  The Service is not directed at individuals under 18 years of age. We do
                  not knowingly collect personal data from children. If you believe a
                  child has provided us personal data, please contact us and we will take
                  steps to delete it.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  13. Grievance Redressal
                </h2>
                <p>
                  In accordance with the Information Technology Act, 2000 and applicable
                  rules, you may raise privacy-related grievances with our Grievance
                  Officer:
                </p>
                <p className="mt-3">
                  <span className="text-white font-medium">Grievance Officer</span>
                  <br />
                  ClashBid
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
                <p className="mt-3">
                  We will acknowledge grievances within a reasonable time and endeavour
                  to resolve them within thirty (30) days, or as required by applicable
                  law.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  14. Changes to This Policy
                </h2>
                <p>
                  We may update this Privacy Policy from time to time. The revised
                  version will be posted on this page with an updated date. Material
                  changes may be communicated by email or prominent notice on the
                  Service where appropriate.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">
                  15. Contact Us
                </h2>
                <p>
                  For privacy questions, data requests, or grievances, contact:
                </p>
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

export default Privacy;
