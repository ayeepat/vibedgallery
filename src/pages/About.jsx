import { Link } from "react-router-dom";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { usePageMeta } from "@/lib/usePageMeta";

export default function About() {
  usePageMeta({
    title: "About",
    description:
      "VibedGallery is a public gallery of apps built with AI, shared by the people who made them.",
    path: "/about",
  });

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Nav hideSearch />

      <main className="flex-1 pt-14">
        <section className="border-b border-[#E5E5E5]">
          <div className="max-w-3xl mx-auto px-8 py-16">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#717171] mb-6">
              About
            </p>
            <h1
              className="text-[clamp(3rem,6.5vw,6rem)] font-black uppercase leading-[0.9] text-black"
              style={{ letterSpacing: "-0.04em" }}
            >
              ABOUT<br />VIBEDGALLERY.
            </h1>
            <p className="mt-6 text-sm text-[#717171]">
              Apps built with AI, shared by the people who made them.
            </p>
          </div>
        </section>

        <article className="max-w-3xl mx-auto px-8 py-12 prose-content">
          <p>
            <strong>VibedGallery</strong> is a public gallery for apps built with AI tools. Makers submit what they shipped, visitors browse and upvote, and every app links back to its live demo and its maker. The goal is simple: give the growing wave of AI-built software a clean, credible place to be discovered.
          </p>

          <Section title="What you can do here">
            <ul>
              <li><strong>Browse the gallery</strong> — explore apps across categories, sorted by what people are using and loving right now.</li>
              <li><strong>Submit your own app</strong> — share something you built, link to the live demo, credit the tools you used, and reach a curious audience.</li>
              <li><strong>Follow makers</strong> — every submission has a public maker profile, so you can see what one person has been shipping.</li>
              <li><strong>Upvote what you like</strong> — signal-boost the apps that deserve attention.</li>
            </ul>
          </Section>

          <Section title="Who it&rsquo;s for">
            <p>
              Indie hackers, designers, students, weekend builders, and full-time engineers who use AI tools (Claude, Cursor, v0, Lovable, Bolt, Replit, Base44, and others) to ship real software. If you built something and want people to see it, you belong here.
            </p>
          </Section>

          <Section title="How submissions work">
            <p>
              Anyone with an account can submit. Each submission goes through a lightweight review for safety and basic quality before it appears in the public gallery. We use Google Safe Browsing to screen submitted URLs and Cloudflare Turnstile to keep bots out. Read the full process on the <Link className="link" to="/how-it-works">How It Works</Link> page.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions, feedback, or press:{" "}
              <a className="link" href="mailto:support@vibedgallery.com">
                support@vibedgallery.com
              </a>
              .
            </p>
            <p>
              See our <a className="link" href="/terms">Terms</a> and <a className="link" href="/privacy">Privacy Policy</a> for the legal details.
            </p>
          </Section>
        </article>
      </main>

      <Footer />

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
