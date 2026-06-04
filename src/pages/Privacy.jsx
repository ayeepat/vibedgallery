import { Link } from "react-router-dom";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { usePageMeta } from "@/lib/usePageMeta";

const EFFECTIVE_DATE = "June 4, 2026";

export default function Privacy() {
  usePageMeta({
    title: "Privacy Policy",
    description:
      "How VibedGallery collects, uses, stores, and protects your personal information.",
    path: "/privacy",
  });

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Nav hideSearch />

      <main className="flex-1 pt-14">
        <section className="border-b border-[#E5E5E5]">
          <div className="max-w-3xl mx-auto px-8 py-16">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-4">
              Legal
            </p>
            <h1
              className="text-[clamp(2.5rem,5vw,4.5rem)] font-black uppercase leading-[0.9] text-black"
              style={{ letterSpacing: "-0.04em" }}
            >
              PRIVACY<br />POLICY.
            </h1>
            <p className="mt-6 text-sm text-[#717171]">
              Effective {EFFECTIVE_DATE}
            </p>
          </div>
        </section>

        <article className="max-w-3xl mx-auto px-8 py-12 prose-content">
          <p>
            This policy explains what information VibedGallery (&ldquo;we,&rdquo; &ldquo;us&rdquo;) collects when you use{" "}
            <a className="link" href="https://vibedgallery.com">vibedgallery.com</a>, how we use it, who we share it with, and the choices you have. It applies to the website and any related services we operate. It does not apply to third-party apps that you visit from the gallery — each of those has its own privacy practices.
          </p>

          <Section title="1. Information we collect">
            <h3 className="sub">a. Information you give us</h3>
            <ul>
              <li><strong>Account data:</strong> when you sign up we collect your email address and a hashed password (or a token from your OAuth provider if you sign in with Google or GitHub). You can optionally provide a display name.</li>
              <li><strong>Profile data:</strong> any optional fields you fill in on your profile, such as display name, links, and an avatar URL provided by your OAuth provider.</li>
              <li><strong>App submissions:</strong> title, tagline, description, category, tools used, demo URL, screenshots, optional social links, and a verification token if you choose to verify ownership.</li>
              <li><strong>Communications:</strong> messages you send us by email or support channels.</li>
            </ul>

            <h3 className="sub">b. Information collected automatically</h3>
            <ul>
              <li><strong>Usage and device data:</strong> we collect basic telemetry (page paths, referrer, browser, device type, country-level IP geo) through Vercel Analytics and Vercel Speed Insights. This data is aggregated and used for product analytics and performance monitoring; it is not used for cross-site advertising.</li>
              <li><strong>Security and abuse signals:</strong> we run Cloudflare Turnstile to mitigate bots on signup and sensitive actions. Turnstile may receive your IP address, user-agent, and challenge interactions to score risk.</li>
              <li><strong>Logs:</strong> request logs (IP, timestamp, user-agent, URL, response codes) for diagnostics and security.</li>
            </ul>

            <h3 className="sub">c. Information from third parties</h3>
            <ul>
              <li><strong>OAuth providers (Google, GitHub):</strong> if you choose to sign in with them we receive your verified email address (or a no-reply alias from GitHub if your email is private), basic profile name, and avatar URL.</li>
              <li><strong>Google Safe Browsing:</strong> we may send a submitted app&rsquo;s URL to Google Safe Browsing to check for known malware or phishing before showing it in the gallery.</li>
            </ul>
          </Section>

          <Section title="2. How we use information">
            <ul>
              <li>To operate the service — create your account, host your submissions, show the gallery, run search, and process upvotes.</li>
              <li>To verify ownership of submitted apps and to moderate content for safety, accuracy, and compliance with our <Link className="link" to="/terms">Terms of Service</Link>.</li>
              <li>To send transactional emails (sign-up verification, password reset, submission status updates). We do not send marketing email today; if we ever do, you will be able to opt out.</li>
              <li>To prevent fraud, abuse, and security incidents.</li>
              <li>To measure and improve performance, fix bugs, and decide what to build next, using aggregate analytics.</li>
              <li>To comply with applicable law and to enforce our rights.</li>
            </ul>
          </Section>

          <Section title="3. Legal bases (EEA / UK users)">
            <p>If you are in the European Economic Area or the United Kingdom, our legal bases under the GDPR / UK GDPR are:</p>
            <ul>
              <li><strong>Contract</strong> — to provide the account and service you signed up for.</li>
              <li><strong>Legitimate interests</strong> — to keep the service secure, prevent abuse, and run aggregate analytics. We balance these against your rights and freedoms.</li>
              <li><strong>Consent</strong> — for any processing that requires it (you can withdraw consent at any time).</li>
              <li><strong>Legal obligation</strong> — to comply with applicable law.</li>
            </ul>
          </Section>

          <Section title="4. How we share information">
            <p>We do not sell your personal data. We share information only with:</p>
            <ul>
              <li><strong>Service providers (sub-processors)</strong> who run the infrastructure on our behalf:
                <ul>
                  <li><em>Supabase</em> — database, authentication, file storage, and edge functions.</li>
                  <li><em>Vercel</em> — website hosting, analytics, and performance monitoring.</li>
                  <li><em>Cloudflare</em> — bot protection (Turnstile) and edge security.</li>
                  <li><em>Google</em> — OAuth sign-in and Safe Browsing URL checks (when applicable).</li>
                  <li><em>GitHub</em> — OAuth sign-in (when you choose it).</li>
                  <li><em>Email delivery provider</em> — to send transactional emails.</li>
                </ul>
              </li>
              <li><strong>Other users</strong> — your public profile (display name, avatar, and submitted apps) is visible to anyone who visits the site. Your email address is never shown publicly.</li>
              <li><strong>Legal and safety</strong> — to comply with valid legal process, enforce our terms, or protect the rights, property, or safety of users, the public, or VibedGallery.</li>
              <li><strong>Business transfers</strong> — if VibedGallery is involved in a merger, acquisition, or asset sale, your information may be transferred. We will notify users before personal data becomes subject to a different policy.</li>
            </ul>
          </Section>

          <Section title="5. International transfers">
            <p>
              VibedGallery&rsquo;s primary infrastructure runs on servers in the European Union (Supabase, region <code>eu-central-1</code>). Some sub-processors (e.g., Vercel, Google, GitHub) operate globally and may process information in the United States or other countries. Where required, we rely on appropriate safeguards such as the EU Standard Contractual Clauses for transfers outside the EEA / UK.
            </p>
          </Section>

          <Section title="6. Data retention">
            <ul>
              <li>Account data is retained for as long as your account is active. When you delete your account, your personal data is deleted within 30 days, except where we are required to keep it longer (e.g., for security logs or legal records).</li>
              <li>Submitted apps remain visible while your account is active and the submission is approved. You can delete a submission from your profile.</li>
              <li>Logs and aggregate analytics are kept for a rolling window (typically up to 12 months) and then automatically deleted or de-identified.</li>
            </ul>
          </Section>

          <Section title="7. Your rights">
            <p>Depending on where you live, you may have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate or incomplete data.</li>
              <li>Delete your data (&ldquo;right to be forgotten&rdquo;).</li>
              <li>Restrict or object to certain processing.</li>
              <li>Receive a copy of your data in a portable format.</li>
              <li>Withdraw consent where processing is based on consent.</li>
              <li>Lodge a complaint with your local data protection authority.</li>
            </ul>
            <p>
              To exercise any of these rights, email{" "}
              <a className="link" href="mailto:support@vibedgallery.com">support@vibedgallery.com</a>. We may need to verify your identity before acting on a request.
            </p>
            <p>
              California residents have additional rights under the CCPA / CPRA, including the right to know what categories of personal information we collect, to delete it, and to opt out of any &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; — we do not sell or share personal information for cross-context behavioral advertising.
            </p>
          </Section>

          <Section title="8. Cookies and similar technologies">
            <p>
              We use a small number of strictly-necessary technologies:
            </p>
            <ul>
              <li><strong>Authentication tokens</strong> stored in your browser&rsquo;s <code>localStorage</code> to keep you signed in.</li>
              <li><strong>Vercel Analytics</strong> uses a privacy-preserving first-party cookie / identifier to count unique visits. No cross-site tracking.</li>
              <li><strong>Cloudflare Turnstile</strong> may set cookies needed to deliver its bot challenge.</li>
            </ul>
            <p>
              You can clear these at any time through your browser settings; doing so will sign you out of VibedGallery.
            </p>
          </Section>

          <Section title="9. Security">
            <p>
              We use industry-standard safeguards — TLS in transit, encryption at rest, access controls, row-level security on the database, and bot protection — to protect your information. No system is perfectly secure; if we ever experience a data incident affecting your data we will notify you and the relevant authorities as required by law.
            </p>
          </Section>

          <Section title="10. Children's privacy">
            <p>
              VibedGallery is not intended for children under 13 (or the minimum age in your country, if higher). We do not knowingly collect personal data from children. If you believe a child has provided us personal data, contact us and we will delete it.
            </p>
          </Section>

          <Section title="11. Changes to this policy">
            <p>
              We may update this policy from time to time. When we do, we will revise the &ldquo;Effective&rdquo; date above and, for material changes, post a notice on the site or notify you by email.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              Privacy questions, requests, or complaints:{" "}
              <a className="link" href="mailto:support@vibedgallery.com">
                support@vibedgallery.com
              </a>
              .
            </p>
          </Section>
        </article>
      </main>

      <Footer />

      <style>{`
        .prose-content { color: #111; }
        .prose-content p { font-size: 14px; line-height: 1.7; color: #222; margin-bottom: 1rem; }
        .prose-content ul { list-style: disc; padding-left: 1.25rem; margin-bottom: 1rem; }
        .prose-content ul ul { list-style: circle; margin-top: 0.25rem; margin-bottom: 0.25rem; }
        .prose-content li { font-size: 14px; line-height: 1.7; color: #222; margin-bottom: 0.25rem; }
        .prose-content h2 { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #000; margin: 2rem 0 0.75rem; }
        .prose-content h3.sub { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #444; margin: 1.25rem 0 0.5rem; }
        .prose-content .link { color: #000; text-decoration: underline; text-underline-offset: 3px; }
        .prose-content code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; background: #F5F5F5; padding: 0 4px; }
      `}</style>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
