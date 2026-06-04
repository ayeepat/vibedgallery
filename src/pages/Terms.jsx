import { Link } from "react-router-dom";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { usePageMeta } from "@/lib/usePageMeta";

// Last meaningful change to these terms — bump when you edit the body.
const EFFECTIVE_DATE = "June 4, 2026";

export default function Terms() {
  usePageMeta({
    title: "Terms of Service",
    description:
      "The terms governing your use of VibedGallery — what you can submit, what we host, and how disputes are resolved.",
    path: "/terms",
  });

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Nav hideSearch />

      <main className="flex-1 pt-14">
        {/* Header */}
        <section className="border-b border-[#E5E5E5]">
          <div className="max-w-3xl mx-auto px-8 py-16">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-4">
              Legal
            </p>
            <h1
              className="text-[clamp(2.5rem,5vw,4.5rem)] font-black uppercase leading-[0.9] text-black"
              style={{ letterSpacing: "-0.04em" }}
            >
              TERMS OF<br />SERVICE.
            </h1>
            <p className="mt-6 text-sm text-[#717171]">
              Effective {EFFECTIVE_DATE}
            </p>
          </div>
        </section>

        {/* Body */}
        <article className="max-w-3xl mx-auto px-8 py-12 prose-content">
          <Section title="1. Who we are">
            <p>
              VibedGallery (<a className="link" href="https://vibedgallery.com">vibedgallery.com</a>) is a community-driven gallery of apps built with AI coding tools. These Terms of Service form an agreement between you and the operator of VibedGallery (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;VibedGallery&rdquo;) and govern your access to and use of the website, content, and services we provide.
            </p>
            <p>
              By accessing or using VibedGallery you agree to be bound by these terms and by our {" "}
              <Link className="link" to="/privacy">Privacy Policy</Link>. If you do not agree, please do not use the site.
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              You must be at least 13 years old to use VibedGallery, or the minimum age required for online services in your country, whichever is higher. By creating an account you confirm that you meet that age requirement and that the information you provide is accurate.
            </p>
          </Section>

          <Section title="3. Accounts">
            <p>
              You are responsible for keeping your sign-in credentials secure and for everything that happens under your account. You agree to notify us promptly at the email address listed below if you suspect unauthorized access. You may close your account at any time from the Profile page; doing so does not automatically remove apps you have submitted.
            </p>
          </Section>

          <Section title="4. User submissions">
            <p>
              When you submit an app, you represent that:
            </p>
            <ul>
              <li>You own the app or have explicit permission from the owner to list it.</li>
              <li>The information you provide (title, description, URL, screenshots, etc.) is accurate and not misleading.</li>
              <li>The app and its destination URL comply with applicable law and these terms.</li>
            </ul>
            <p>
              You retain ownership of the content you submit. You grant VibedGallery a worldwide, non-exclusive, royalty-free, transferable license to host, copy, store, reproduce, publicly display, distribute, and create derivative works of your submitted content (titles, taglines, descriptions, screenshots, links, etc.) for the purpose of operating, promoting, and improving the service. This license ends when you delete the content from VibedGallery, except for cached or back-up copies retained in the ordinary course of operating the site and copies used for legitimate business records.
            </p>
          </Section>

          <Section title="5. Verification">
            <p>
              We may ask you to verify that you control a submitted app by hosting a verification file on its domain. Verification is provided solely to reduce impersonation; it is not an endorsement, audit, or guarantee of any kind regarding the app or the maker.
            </p>
          </Section>

          <Section title="6. Acceptable use">
            <p>You agree not to:</p>
            <ul>
              <li>Submit content that is illegal, infringing, defamatory, harassing, hateful, or sexually exploitative of minors.</li>
              <li>Submit malware, phishing pages, scams, or links that endanger users.</li>
              <li>Impersonate another person or misrepresent your affiliation with an app or organization.</li>
              <li>Scrape, copy, or republish the gallery in bulk without our prior written consent, beyond what is permitted for search engines and accessibility tools.</li>
              <li>Attempt to bypass rate-limits, captchas, authentication, or other security controls.</li>
              <li>Use the service in a way that could disable, overburden, or impair the site.</li>
            </ul>
            <p>
              We may, at our discretion, remove any content or suspend or terminate any account that violates these terms or that we reasonably believe poses a risk to the service or its users.
            </p>
          </Section>

          <Section title="7. Third-party links">
            <p>
              VibedGallery surfaces links to third-party apps and websites. We do not control those destinations, do not warrant their content or security, and are not responsible for what happens after you click through. Visit them at your own risk and review the third party&rsquo;s own terms and privacy policy.
            </p>
          </Section>

          <Section title="8. Intellectual property">
            <p>
              The VibedGallery brand, logo, and the software powering the site are owned by us and protected by applicable copyright, trademark, and other laws. Nothing in these terms transfers any of those rights to you.
            </p>
            <p>
              If you believe content on VibedGallery infringes your copyright, send a notice to the contact address below including (a) identification of the copyrighted work, (b) the URL of the allegedly infringing material, (c) your contact information, (d) a statement of good-faith belief that the use is not authorized, and (e) a statement under penalty of perjury that the information is accurate and that you are authorized to act.
            </p>
          </Section>

          <Section title="9. Disclaimer of warranties">
            <p>
              VibedGallery is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. To the maximum extent permitted by law, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, non-infringement, and any warranty that the service will be uninterrupted, secure, or error-free. Apps listed in the gallery are created by third parties; we do not endorse, certify, or guarantee any of them.
            </p>
          </Section>

          <Section title="10. Limitation of liability">
            <p>
              To the maximum extent permitted by law, VibedGallery, its operators, and contributors will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or goodwill, arising out of or related to your use of (or inability to use) the service. Our total liability for any claim arising out of or relating to these terms or the service will not exceed the greater of (a) US$50 or (b) the amount you paid us in the twelve months preceding the claim.
            </p>
          </Section>

          <Section title="11. Indemnity">
            <p>
              You agree to defend, indemnify, and hold harmless VibedGallery and its operators from any claim, demand, loss, or expense (including reasonable legal fees) arising out of or related to (a) your content, (b) your use of the service, or (c) your violation of these terms or any applicable law or third-party right.
            </p>
          </Section>

          <Section title="12. Termination">
            <p>
              You may stop using VibedGallery at any time. We may suspend or terminate your access at any time for any reason, with or without notice, including if we reasonably believe you have breached these terms. Sections that by their nature should survive termination (e.g., licenses you granted, disclaimers, limitations of liability, indemnity, and dispute provisions) will survive.
            </p>
          </Section>

          <Section title="13. Changes to these terms">
            <p>
              We may update these terms from time to time. If we make material changes we will use reasonable means to let you know — for example, by updating the &ldquo;Effective&rdquo; date above or posting a notice on the site. Your continued use of VibedGallery after a change takes effect constitutes acceptance of the updated terms.
            </p>
          </Section>

          <Section title="14. Governing law">
            <p>
              These terms are governed by the laws of the operator&rsquo;s jurisdiction, without regard to its conflict-of-laws principles. Mandatory consumer protection laws of your country of residence still apply where they cannot be waived by contract.
            </p>
          </Section>

          <Section title="15. Contact">
            <p>
              Questions about these terms? Reach us at{" "}
              <a className="link" href="mailto:hello@vibedgallery.com">
                hello@vibedgallery.com
              </a>
              .
            </p>
          </Section>
        </article>
      </main>

      <Footer />

      {/* Minimal in-page styling for prose — kept here to avoid global CSS edits */}
      <style>{`
        .prose-content { color: #111; }
        .prose-content p { font-size: 14px; line-height: 1.7; color: #222; margin-bottom: 1rem; }
        .prose-content ul { list-style: disc; padding-left: 1.25rem; margin-bottom: 1rem; }
        .prose-content li { font-size: 14px; line-height: 1.7; color: #222; margin-bottom: 0.25rem; }
        .prose-content h2 { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #000; margin: 2rem 0 0.75rem; }
        .prose-content .link { color: #000; text-decoration: underline; text-underline-offset: 3px; }
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
