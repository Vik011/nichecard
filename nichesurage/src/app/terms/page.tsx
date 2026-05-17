import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — SurgeNiche",
};

const EFFECTIVE_DATE = "May 7, 2026";
const SUPPORT_EMAIL = "support@surgeniche.com";

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <Link
        href="/"
        className="text-sm text-ink-muted hover:text-ink transition-colors"
      >
        ← Back to SurgeNiche
      </Link>

      <h1 className="text-3xl font-bold text-ink mt-8 mb-2">
        Terms of Service
      </h1>
      <p className="text-ink-subtle text-sm mb-10">
        Effective date: {EFFECTIVE_DATE}
      </p>

      <hr className="border-hairline-edge mb-10" />

      {/* 1. Acceptance */}
      <h2 className="text-ink font-semibold text-xl mt-10 mb-3">
        1. Acceptance of Terms
      </h2>
      <p className="text-ink-muted leading-relaxed mb-4">
        By accessing or using SurgeNiche (the &quot;Service&quot;), you agree to
        be bound by these Terms of Service (&quot;Terms&quot;). If you do not
        agree, you must not use the Service. These Terms form a legally binding
        agreement between you and the operator identified in Section 12 below
        (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
      </p>
      <p className="text-ink-muted leading-relaxed mb-4">
        We may update these Terms at any time. Continued use of the Service
        after any changes constitutes your acceptance of the revised Terms.
      </p>

      {/* 2. Service description */}
      <h2 className="text-ink font-semibold text-xl mt-10 mb-3">
        2. Service Description
      </h2>
      <p className="text-ink-muted leading-relaxed mb-4">
        SurgeNiche is an AI-powered YouTube niche discovery platform. The
        Service scans publicly available YouTube channel data, detects trending
        topics and viral spikes, and presents opportunity scores to help content
        creators identify potentially underserved niches.
      </p>
      <p className="text-ink-muted leading-relaxed mb-4">
        All data and insights provided by SurgeNiche are{" "}
        <span className="text-ink-muted font-medium">informational only</span>.
        Nothing on the platform constitutes financial, investment, or business
        advice. Past spike patterns and opportunity scores are analytical
        signals, not guarantees of future channel performance, growth, or
        revenue.
      </p>

      {/* 3. Subscriptions & billing */}
      <h2 className="text-ink font-semibold text-xl mt-10 mb-3">
        3. Subscriptions &amp; Billing
      </h2>
      <p className="text-ink-muted leading-relaxed mb-4">
        SurgeNiche offers the following subscription plans:
      </p>
      <ul className="text-ink-muted leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          <span className="text-ink-muted font-medium">Free</span> — limited
          access to niche data with no charge.
        </li>
        <li>
          <span className="text-ink-muted font-medium">Basic — €9/month</span>{" "}
          (or €90/year) — expanded niche discovery, spike alerts, and
          opportunity scoring.
        </li>
        <li>
          <span className="text-ink-muted font-medium">
            Premium — €19/month
          </span>{" "}
          (or €190/year) — full access including advanced filters, trend
          history, and priority data refresh.
        </li>
      </ul>
      <p className="text-ink-muted leading-relaxed mb-4">
        All payments are processed by Stripe Payments Europe, Limited. By
        subscribing, you authorize Stripe to charge your payment method on a
        recurring basis until you cancel. Prices include any applicable
        value-added tax where required.
      </p>

      {/* 4. Refund policy */}
      <h2 className="text-ink font-semibold text-xl mt-10 mb-3">
        4. Refund Policy
      </h2>
      <p className="text-ink-muted leading-relaxed mb-4">
        <span className="text-ink-muted font-medium">All sales are final.</span>{" "}
        We do not offer refunds for any reason, including unused time on a
        billing period, accidental purchases, or dissatisfaction with the
        Service.
      </p>
      <p className="text-ink-muted leading-relaxed mb-4">
        SurgeNiche relies on third-party AI providers (Anthropic, OpenAI) and
        infrastructure providers (Supabase, Vercel) whose costs are incurred
        immediately as you use the Service. AI features such as Niche Health
        Check, Content Angles, and replication clustering execute paid API
        calls the moment you trigger them. Because those costs cannot be
        recovered, we cannot return them to you in the form of a refund.
      </p>
      <p className="text-ink-muted leading-relaxed mb-4">
        <span className="text-ink-muted font-medium">
          EU 14-day right of withdrawal — express consent and waiver:
        </span>{" "}
        Under Art. 16(m) of EU Directive 2011/83/EU and §356 (5) BGB, the
        14-day right of withdrawal for digital content does not apply once
        performance has begun with your express prior consent and acknowledgment
        that you thereby lose the right of withdrawal. By initiating a paid
        subscription and using any feature of the Service before the 14-day
        window elapses, you give your express consent for performance to begin
        immediately and acknowledge that you waive your right of withdrawal.
        The Stripe checkout flow asks you to confirm this consent before
        completing payment.
      </p>
      <p className="text-ink-muted leading-relaxed mb-4">
        <span className="text-ink-muted font-medium">Exceptions.</span> We may
        review individual cases on request for: (a) duplicate charges caused
        by a payment-processor fault, (b) extended Service outages of more than
        48 continuous hours, (c) charges made after a cancellation we failed to
        register. To request a review, email {SUPPORT_EMAIL} within 14 days of
        the charge.
      </p>

      {/* 5. Cancellation */}
      <h2 className="text-ink font-semibold text-xl mt-10 mb-3">
        5. Cancellation
      </h2>
      <p className="text-ink-muted leading-relaxed mb-4">
        You may cancel your subscription at any time from the &quot;Manage
        subscription&quot; link in your account dashboard or by contacting us.
        Cancellation takes effect at the end of the current paid period; until
        then you retain full access to your tier&apos;s features. We do not
        prorate or refund the unused portion of a billing period.
      </p>
      <p className="text-ink-muted leading-relaxed mb-4">
        After your subscription ends, your account moves to the Free tier. Your
        saved niches and account history are retained but features that exceed
        the Free tier limits become read-only or inaccessible until you
        re-subscribe.
      </p>

      {/* 6. Acceptable use */}
      <h2 className="text-ink font-semibold text-xl mt-10 mb-3">
        6. Acceptable Use
      </h2>
      <p className="text-ink-muted leading-relaxed mb-4">
        You agree to use the Service only for lawful purposes and in accordance
        with these Terms. You must not:
      </p>
      <ul className="text-ink-muted leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          Scrape, crawl, or otherwise extract data from SurgeNiche through
          automated means beyond normal personal use of the web interface.
        </li>
        <li>
          Access the Service via automated scripts, bots, or third-party tools
          for the purpose of bulk data collection.
        </li>
        <li>
          Resell, sublicense, redistribute, or commercialize data or insights
          obtained from the Service without our express written permission.
        </li>
        <li>
          Attempt to reverse-engineer, decompile, or circumvent any aspect of
          the Service or its underlying infrastructure.
        </li>
        <li>
          Use the Service in any way that could impair its performance,
          availability, or integrity, or that could harm other users.
        </li>
      </ul>
      <p className="text-ink-muted leading-relaxed mb-4">
        Violation of these rules may result in immediate termination of your
        account without refund.
      </p>

      {/* 7. Intellectual property */}
      <h2 className="text-ink font-semibold text-xl mt-10 mb-3">
        7. Intellectual Property
      </h2>
      <p className="text-ink-muted leading-relaxed mb-4">
        SurgeNiche and its original content, features, and functionality are
        owned by ELM Social Media (Viktor Martinovic) and are protected by
        applicable intellectual property laws. You may not reproduce,
        distribute, or create derivative works from any part of the Service
        without explicit written permission.
      </p>
      <p className="text-ink-muted leading-relaxed mb-4">
        YouTube channel data displayed within the Service is sourced via the
        YouTube Data API and is subject to the{" "}
        <a
          href="https://www.youtube.com/t/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-muted underline underline-offset-2 hover:text-ink transition-colors"
        >
          YouTube Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-muted underline underline-offset-2 hover:text-ink transition-colors"
        >
          Google Privacy Policy
        </a>
        . SurgeNiche does not claim ownership over any YouTube content or
        channel data.
      </p>

      {/* 8. Disclaimer */}
      <h2 className="text-ink font-semibold text-xl mt-10 mb-3">
        8. Disclaimer of Warranties
      </h2>
      <p className="text-ink-muted leading-relaxed mb-4">
        The Service is provided on an &quot;as is&quot; and &quot;as
        available&quot; basis without warranties of any kind, either express or
        implied, including but not limited to implied warranties of
        merchantability, fitness for a particular purpose, or non-infringement.
      </p>
      <p className="text-ink-muted leading-relaxed mb-4">
        All niche data, opportunity scores, and trend signals are informational
        tools derived from publicly available data. Past spike patterns do not
        guarantee future results. SurgeNiche makes no representations about the
        accuracy, completeness, or timeliness of the data provided.
      </p>

      {/* 9. Limitation of liability */}
      <h2 className="text-ink font-semibold text-xl mt-10 mb-3">
        9. Limitation of Liability
      </h2>
      <p className="text-ink-muted leading-relaxed mb-4">
        To the maximum extent permitted by applicable law, we shall not be
        liable for any indirect, incidental, special, consequential, or
        punitive damages, including but not limited to loss of profits, data,
        or goodwill, arising from your use of or inability to use the Service.
      </p>
      <p className="text-ink-muted leading-relaxed mb-4">
        In no event shall our total aggregate liability to you exceed the total
        amount you paid for the Service in the three (3) months immediately
        preceding the event giving rise to the claim. Mandatory statutory
        liability under applicable consumer-protection law remains unaffected.
      </p>

      {/* 10. Governing law */}
      <h2 className="text-ink font-semibold text-xl mt-10 mb-3">
        10. Governing Law &amp; Jurisdiction
      </h2>
      <p className="text-ink-muted leading-relaxed mb-4">
        These Terms are governed by the laws of the Federal Republic of
        Germany, excluding its conflict-of-law rules and the UN Convention on
        Contracts for the International Sale of Goods. The exclusive place of
        jurisdiction for all disputes arising out of or in connection with
        these Terms is Mülheim an der Ruhr, to the extent permitted by law.
      </p>
      <p className="text-ink-muted leading-relaxed mb-4">
        Mandatory consumer-protection provisions of the country in which you
        habitually reside remain unaffected.
      </p>

      {/* 11. Changes to terms */}
      <h2 className="text-ink font-semibold text-xl mt-10 mb-3">
        11. Changes to These Terms
      </h2>
      <p className="text-ink-muted leading-relaxed mb-4">
        We may update these Terms from time to time to reflect changes in the
        Service, applicable law, or our business practices. When we make
        material changes, we will update the effective date at the top of this
        page and may also notify you by email.
      </p>
      <p className="text-ink-muted leading-relaxed mb-4">
        Your continued use of the Service after the revised Terms have been
        posted constitutes your acceptance of those changes. If you do not
        agree to the revised Terms, you must stop using the Service.
      </p>

      {/* 12. Imprint / Operator */}
      <h2 className="text-ink font-semibold text-xl mt-10 mb-3">
        12. Operator &amp; Imprint (Anbieterkennzeichnung gem. § 5 TMG)
      </h2>
      <div className="text-ink-muted leading-relaxed mb-4 space-y-1">
        <p>ELM Social Media</p>
        <p>Inhaber: Viktor Martinovic</p>
        <p>Hingbergstr. 322</p>
        <p>45472 Mülheim an der Ruhr</p>
        <p>Germany</p>
      </div>
      <p className="text-ink-muted leading-relaxed mb-4">
        Contact:{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-ink-muted underline underline-offset-2 hover:text-ink transition-colors"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>
      <p className="text-ink-muted leading-relaxed mb-4">
        VAT identification number: not applicable. Operates as Kleinunternehmer
        per § 19 UStG; no VAT is shown or charged.
      </p>
      <p className="text-ink-muted leading-relaxed mb-4">
        Person responsible for content within the meaning of § 18 (2) MStV:
        Viktor Martinovic (address as above).
      </p>

      {/* 13. Contact */}
      <h2 className="text-ink font-semibold text-xl mt-10 mb-3">
        13. Contact
      </h2>
      <p className="text-ink-muted leading-relaxed mb-4">
        Questions about these Terms? Email us at{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-ink-muted underline underline-offset-2 hover:text-ink transition-colors"
        >
          {SUPPORT_EMAIL}
        </a>
        .
      </p>

      <hr className="border-hairline-edge mt-12" />
    </main>
  );
}
