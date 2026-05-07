import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — SurgeNiche",
};

const LAST_UPDATED = "May 7, 2026";
const SUPPORT_EMAIL = "support@surgeniche.com";

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <Link
        href="/"
        className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        ← Back to SurgeNiche
      </Link>

      <h1 className="text-3xl font-bold text-slate-100 mt-8 mb-2">
        Privacy Policy
      </h1>
      <p className="text-slate-500 text-sm mb-10">Last updated: {LAST_UPDATED}</p>

      <hr className="border-slate-800 mb-10" />

      {/* 1. Data controller */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        1. Data Controller
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        The data controller responsible for the processing of personal data on
        SurgeNiche under Art. 4 (7) GDPR is:
      </p>
      <div className="text-slate-400 leading-relaxed mb-4 space-y-1">
        <p>ELM Social Media</p>
        <p>Inhaber: Viktor Martinovic</p>
        <p>Hingbergstr. 322</p>
        <p>45472 Mülheim an der Ruhr</p>
        <p>Germany</p>
      </div>
      <p className="text-slate-400 leading-relaxed mb-4">
        Contact:{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>

      {/* 2. What data we collect */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        2. What Data We Collect
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        We collect only the minimum data necessary to operate the Service:
      </p>
      <ul className="text-slate-400 leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          <span className="text-slate-300 font-medium">
            Account data
          </span>{" "}
          — email address, name (when provided by your Google account on
          sign-in), and a unique account identifier. Authentication is handled
          via Supabase Auth.
        </li>
        <li>
          <span className="text-slate-300 font-medium">Subscription data</span>{" "}
          — current tier (Free / Basic / Premium), subscription status, and
          billing-period dates. We do <strong>not</strong> store card numbers,
          CVVs, or any raw payment-card data; that is held by Stripe.
        </li>
        <li>
          <span className="text-slate-300 font-medium">Usage data</span> —
          niches you save, AI features you trigger (Niche Health Check, Content
          Angles), and per-day quota counters.
        </li>
        <li>
          <span className="text-slate-300 font-medium">Product analytics</span>{" "}
          — page views and feature interactions collected via PostHog (EU
          region) only after you accept the cookie banner. IP addresses are
          anonymized at collection.
        </li>
        <li>
          <span className="text-slate-300 font-medium">Error telemetry</span>{" "}
          — Sentry captures exception data for debugging. Auth headers, cookies
          and Stripe signatures are stripped before transmission.
        </li>
      </ul>

      {/* 3. Legal bases */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        3. Legal Bases for Processing (Art. 6 GDPR)
      </h2>
      <ul className="text-slate-400 leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          <span className="text-slate-300 font-medium">
            Performance of contract (Art. 6 (1)(b))
          </span>{" "}
          — to deliver the Service you signed up for, including authentication,
          subscription billing, and AI feature execution.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Legitimate interests (Art. 6 (1)(f))
          </span>{" "}
          — for keeping the Service secure (rate limiting, bot defense via
          Cloudflare Turnstile) and for diagnosing errors via Sentry. You may
          object to this processing at any time.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Consent (Art. 6 (1)(a))
          </span>{" "}
          — for non-essential analytics cookies (PostHog). You can revoke
          consent at any time via the cookie banner or browser controls.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Legal obligation (Art. 6 (1)(c))
          </span>{" "}
          — Stripe retains billing records for longer periods as required by
          applicable tax and financial regulations.
        </li>
      </ul>

      {/* 4. Sub-processors */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        4. Sub-Processors
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        SurgeNiche relies on the following sub-processors. Each operates under
        its own GDPR-compliant data processing agreement and is selected for
        EU or adequacy-listed jurisdictions where possible:
      </p>
      <ul className="text-slate-400 leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          <span className="text-slate-300 font-medium">Supabase</span> —
          database and authentication. Data hosted in the EU region (Frankfurt,
          Germany).{" "}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
          >
            Privacy
          </a>
        </li>
        <li>
          <span className="text-slate-300 font-medium">Stripe</span> — payment
          processing and subscription management. PCI DSS Level 1 certified.{" "}
          <a
            href="https://stripe.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
          >
            Privacy
          </a>
        </li>
        <li>
          <span className="text-slate-300 font-medium">Vercel</span> — hosting
          and edge delivery. Request logs are processed transiently.{" "}
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
          >
            Privacy
          </a>
        </li>
        <li>
          <span className="text-slate-300 font-medium">Resend</span> —
          transactional email delivery (welcome email, billing receipts).{" "}
          <a
            href="https://resend.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
          >
            Privacy
          </a>
        </li>
        <li>
          <span className="text-slate-300 font-medium">PostHog</span> —
          product analytics. PostHog Cloud (EU) with IP anonymization enabled.
          Loaded only after consent.{" "}
          <a
            href="https://posthog.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
          >
            Privacy
          </a>
        </li>
        <li>
          <span className="text-slate-300 font-medium">Sentry</span> — error
          telemetry. Auth headers, cookies, and Stripe signatures are stripped
          before transmission.{" "}
          <a
            href="https://sentry.io/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
          >
            Privacy
          </a>
        </li>
        <li>
          <span className="text-slate-300 font-medium">Cloudflare</span> —
          Turnstile bot defense on the login form.{" "}
          <a
            href="https://www.cloudflare.com/privacypolicy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
          >
            Privacy
          </a>
        </li>
        <li>
          <span className="text-slate-300 font-medium">Anthropic</span> — AI
          inference for Niche Health Check and Content Angles. Niche metadata
          (no email or account ID) is sent for the duration of the request.{" "}
          <a
            href="https://www.anthropic.com/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
          >
            Privacy
          </a>
        </li>
        <li>
          <span className="text-slate-300 font-medium">OpenAI</span> —
          embeddings generation for replication clustering. Only public YouTube
          video titles are sent.{" "}
          <a
            href="https://openai.com/policies/privacy-policy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
          >
            Privacy
          </a>
        </li>
        <li>
          <span className="text-slate-300 font-medium">YouTube Data API</span>{" "}
          (Google) — public channel and video data is fetched server-side. We
          do not pass user identity to Google.{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
          >
            Privacy
          </a>
        </li>
      </ul>
      <p className="text-slate-400 leading-relaxed mb-4">
        We do not sell your personal data to any third party, nor share it for
        cross-context advertising.
      </p>

      {/* 5. International transfers */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        5. International Transfers
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        Some sub-processors (e.g. Stripe, Anthropic, OpenAI, Sentry) operate
        infrastructure in the United States. Where personal data is transferred
        outside the EEA, we rely on the EU Standard Contractual Clauses (SCCs)
        as approved by the European Commission and, where applicable, the
        EU-US Data Privacy Framework, to ensure an adequate level of protection.
      </p>

      {/* 6. Your rights */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        6. Your Rights Under GDPR
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        If you are located in the European Economic Area (EEA), Switzerland, or
        the United Kingdom, you have the following rights:
      </p>
      <ul className="text-slate-400 leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          <span className="text-slate-300 font-medium">Right of access</span>{" "}
          (Art. 15) — request a copy of the personal data we hold about you.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Right to rectification
          </span>{" "}
          (Art. 16) — request correction of inaccurate or incomplete data.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Right to erasure
          </span>{" "}
          (Art. 17) — request deletion of your personal data.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Right to restriction
          </span>{" "}
          (Art. 18) — request that we restrict processing in certain
          circumstances.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Right to data portability
          </span>{" "}
          (Art. 20) — receive your data in a structured, commonly used,
          machine-readable format.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Right to object
          </span>{" "}
          (Art. 21) — object to processing based on legitimate interests.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Right to withdraw consent
          </span>{" "}
          (Art. 7) — withdraw analytics consent at any time without affecting
          the lawfulness of past processing.
        </li>
      </ul>
      <p className="text-slate-400 leading-relaxed mb-4">
        To exercise any of these rights, email{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
        >
          {SUPPORT_EMAIL}
        </a>
        . We will respond within 30 days. You also have the right to lodge a
        complaint with the data protection authority of your jurisdiction;
        for users in Germany this is the Landesbeauftragte für Datenschutz und
        Informationsfreiheit Nordrhein-Westfalen (LDI NRW).
      </p>

      {/* 7. Cookies */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        7. Cookies
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        We use two categories of cookies:
      </p>
      <ul className="text-slate-400 leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          <span className="text-slate-300 font-medium">
            Essential cookies
          </span>{" "}
          — required for authentication session management (Supabase Auth) and
          for basic app state (e.g. the first-login demo cookie). These cannot
          be disabled without breaking login functionality.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Analytics cookies
          </span>{" "}
          — set by PostHog only after you accept the cookie banner. You can
          revoke consent by re-opening the banner or clearing browser storage.
        </li>
      </ul>

      {/* 8. Data retention */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        8. Data Retention
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        We retain account data (email, subscription status, saved niches) for
        as long as your account is active. Upon receiving a verified deletion
        request, we will delete your personal data within 30 days, subject to
        any legal retention obligations (e.g. tax records held by Stripe).
        Anonymized analytics data that cannot be linked back to you may be
        retained indefinitely for aggregate product research.
      </p>

      {/* 9. Children */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        9. Children
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        SurgeNiche is not directed at children under the age of 16. We do not
        knowingly collect personal data from children. If you believe a child
        has signed up, contact us and we will delete the account.
      </p>

      {/* 10. Changes */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        10. Changes to This Policy
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        We may update this Privacy Policy to reflect changes in the Service or
        in applicable law. Material changes are reflected in the &quot;Last
        updated&quot; date at the top of this page; we may also notify you by
        email when changes affect how we process your data.
      </p>

      {/* 11. Contact */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        11. Contact
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        For any privacy-related questions, data requests, or complaints, email
        us at{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
        >
          {SUPPORT_EMAIL}
        </a>
        . If you believe we have not adequately addressed your concern, you can
        lodge a complaint with your local data protection authority.
      </p>

      <hr className="border-slate-800 mt-12" />
    </main>
  );
}
