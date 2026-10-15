import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy" };

/** Describes what the app genuinely does today, not a generic template:
 *  Supabase auth and Postgres, Vercel hosting, optional Google sign-in,
 *  optional Telegram linking, and Gemini for question explanations. Update it
 *  whenever one of those changes. */
const UPDATED = "16 October 2026";
const CONTACT = "adityaissc7@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <article>
      <h1 className="font-display text-3xl tracking-tight text-ink">Privacy policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated {UPDATED}</p>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        taiyariaada is an exam practice tool. This policy explains exactly what it stores,
        why, and who else can see it. It describes how the service actually works rather
        than listing every permission we might one day want.
      </p>

      <Section title="What we collect">
        <p>
          <strong className="text-ink">Account details.</strong> Your email address and a
          display name. If you sign in with Google we receive your email, name and profile
          picture URL from Google — nothing else, and we never gain access to your Gmail,
          Drive or contacts.
        </p>
        <p>
          <strong className="text-ink">Your practice activity.</strong> The tests you take,
          the answers you choose, your scores, which questions you bookmark, and any private
          notes you write on a question. This is the data the app exists to show you back.
        </p>
        <p>
          <strong className="text-ink">Telegram ID, only if you link one.</strong> Used
          solely to send the daily practice messages you asked for. Unlink at any time from
          Settings.
        </p>
        <p>
          We do not collect payment details, we do not run advertising, and we do not use
          third-party analytics or tracking pixels.
        </p>
      </Section>

      <Section title="Who processes it">
        <p>
          <strong className="text-ink">Supabase</strong> hosts the database and handles
          sign-in. <strong className="text-ink">Vercel</strong> hosts and serves the site.
          <strong className="text-ink"> Google</strong> handles sign-in if you choose that
          option. <strong className="text-ink">Telegram</strong> delivers daily messages if
          you link an account.
        </p>
        <p>
          When you ask for an AI explanation of a question, the question text, its options
          and its stored answer are sent to{" "}
          <strong className="text-ink">Google&rsquo;s Gemini API</strong> to generate that
          explanation. Your name, email and score history are not included in that request.
        </p>
        <p>We do not sell your data, and we do not share it for advertising.</p>
      </Section>

      <Section title="Who can see your activity">
        <p>
          Your attempts, scores, bookmarks and notes are private to your account and
          enforced at the database level, not merely hidden in the interface.
        </p>
        <p>
          Two deliberate exceptions: an administrator can see which tests have been assigned
          and completed in order to run a batch, and the leaderboard shows your display name
          alongside your average score to other signed-in learners. Your individual answers
          are never shown on the leaderboard.
        </p>
      </Section>

      <Section title="How long it is kept">
        <p>
          Your account and practice history are kept while your account exists, because the
          spaced-repetition schedule and progress tracking are built from them.
        </p>
        <p>
          Email {CONTACT} to request deletion of your account and its data. Questions and
          sets belong to the shared library and are not personal data, so they remain.
        </p>
      </Section>

      <Section title="Children">
        <p>
          The service is intended for candidates preparing for public service examinations
          and is not directed at children under 13.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If this policy changes materially, the date at the top will change. Questions,
          corrections or deletion requests: {CONTACT}.
        </p>
      </Section>
    </article>
  );
}
