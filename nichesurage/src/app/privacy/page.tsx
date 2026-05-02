import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — SurgeNiche",
};

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
      <p className="text-slate-500 text-sm mb-10">Last updated: May 2, 2026</p>

      <hr className="border-slate-800 mb-10" />

      {/* 1. Who we are */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        1. Who We Are
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        SurgeNiche is an AI-powered YouTube niche discovery platform operated by
        Viktor Martin. If you have any questions about this Privacy Policy or
        how your data is handled, you can reach us at{" "}
        <a
          href="mailto:vikmartin.online@gmail.com"
          className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
        >
          vikmartin.online@gmail.com
        </a>
        .
      </p>

      {/* 2. What data we collect */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        2. What Data We Collect
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        We collect only the minimum data necessary to provide the service:
      </p>
      <ul className="text-slate-400 leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          <span className="text-slate-300 font-medium">Email address</span> —
          collected when you sign up or log in, handled via Supabase Auth.
        </li>
        <li>
          <span className="text-slate-300 font-medium">Usage analytics</span>{" "}
          — anonymized product events (page views, feature interactions)
          collected via PostHog. No personally identifiable information is
          attached to these events unless you are logged in.
        </li>
        <li>
          <span className="text-slate-300 font-medium">Payment metadata</span>{" "}
          — billing information (e.g. subscription status, invoice history) is
          processed entirely by Stripe. We do <strong>not</strong> store card
          numbers, CVVs, or any raw payment card data on our servers.
        </li>
      </ul>

      {/* 3. How we use your data */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        3. How We Use Your Data
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        We use the data we collect for the following purposes:
      </p>
      <ul className="text-slate-400 leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          <span className="text-slate-300 font-medium">Authentication</span> —
          to verify your identity and provide secure access to your account.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Product improvement
          </span>{" "}
          — aggregated, anonymized analytics help us understand how the product
          is used and prioritize improvements.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Transactional emails
          </span>{" "}
          — billing receipts, payment failure alerts, and critical service
          notifications. We do not send marketing emails without explicit
          consent.
        </li>
      </ul>

      {/* 4. Third-party services */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        4. Third-Party Services
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        SurgeNiche relies on the following sub-processors, each of which
        maintains its own GDPR-compliant data processing agreement:
      </p>
      <ul className="text-slate-400 leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          <span className="text-slate-300 font-medium">Supabase</span> —
          database and authentication infrastructure. Data is stored in the EU
          region (Frankfurt).
        </li>
        <li>
          <span className="text-slate-300 font-medium">Stripe</span> — payment
          processing and subscription management. Stripe is PCI DSS Level 1
          certified and GDPR-compliant.
        </li>
        <li>
          <span className="text-slate-300 font-medium">PostHog</span> —
          product analytics. We use PostHog Cloud (EU) with IP anonymization
          enabled.
        </li>
        <li>
          <span className="text-slate-300 font-medium">Vercel</span> — hosting
          and edge delivery of the SurgeNiche web application. Vercel is
          GDPR-compliant and processes request logs transiently.
        </li>
      </ul>
      <p className="text-slate-400 leading-relaxed mb-4">
        We do not sell your personal data to any third party, nor do we share it
        with third parties for advertising purposes.
      </p>

      {/* 5. Your rights (GDPR) */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        5. Your Rights Under GDPR
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        If you are located in the European Economic Area (EEA) or the United
        Kingdom, you have the following rights regarding your personal data:
      </p>
      <ul className="text-slate-400 leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          <span className="text-slate-300 font-medium">Right of access</span>{" "}
          — request a copy of the personal data we hold about you.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Right to rectification
          </span>{" "}
          — request correction of inaccurate or incomplete data.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Right to erasure
          </span>{" "}
          — request deletion of your personal data ("right to be forgotten").
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Right to restriction
          </span>{" "}
          — request that we restrict processing of your data in certain
          circumstances.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Right to data portability
          </span>{" "}
          — receive your data in a structured, commonly used, machine-readable
          format.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Right to object
          </span>{" "}
          — object to processing of your data based on legitimate interests.
        </li>
      </ul>
      <p className="text-slate-400 leading-relaxed mb-4">
        To exercise any of these rights, please email{" "}
        <a
          href="mailto:vikmartin.online@gmail.com"
          className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
        >
          vikmartin.online@gmail.com
        </a>
        . We will respond within 30 days.
      </p>

      {/* 6. Cookies */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        6. Cookies
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        We use two categories of cookies:
      </p>
      <ul className="text-slate-400 leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          <span className="text-slate-300 font-medium">
            Essential cookies
          </span>{" "}
          — required for authentication session management (set by Supabase
          Auth). These cannot be disabled without breaking login functionality.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Analytics cookies
          </span>{" "}
          — set by PostHog to track anonymized product usage. These are only
          activated with your consent. You may opt out at any time by contacting
          us or by blocking cookies in your browser settings.
        </li>
      </ul>

      {/* 7. Data retention */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        7. Data Retention
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        We retain your account data (email address, subscription status) for as
        long as your account is active. Upon receiving a verified deletion
        request, we will delete your personal data within 30 days. Anonymized
        analytics data that cannot be linked back to you may be retained
        indefinitely for aggregate product research.
      </p>
      <p className="text-slate-400 leading-relaxed mb-4">
        Stripe may retain billing records for longer periods as required by
        applicable tax and financial regulations; please refer to{" "}
        <a
          href="https://stripe.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
        >
          Stripe&apos;s Privacy Policy
        </a>{" "}
        for details.
      </p>

      {/* 8. Contact */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        8. Contact
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        For any privacy-related questions, data requests, or complaints, please
        contact us at{" "}
        <a
          href="mailto:vikmartin.online@gmail.com"
          className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
        >
          vikmartin.online@gmail.com
        </a>
        . If you believe we have not adequately addressed your concern, you have
        the right to lodge a complaint with your local data protection authority.
      </p>

      <hr className="border-slate-800 mt-12" />
    </main>
  );
}
