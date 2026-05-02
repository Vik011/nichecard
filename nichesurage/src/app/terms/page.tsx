import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — NicheSurge",
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <Link
        href="/"
        className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        ← Back to NicheSurge
      </Link>

      <h1 className="text-3xl font-bold text-slate-100 mt-8 mb-2">
        Terms of Service
      </h1>
      <p className="text-slate-500 text-sm mb-10">
        Effective date: May 2, 2026
      </p>

      <hr className="border-slate-800 mb-10" />

      {/* 1. Acceptance */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        1. Acceptance of Terms
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        By accessing or using NicheSurge (the &quot;Service&quot;), you agree to
        be bound by these Terms of Service (&quot;Terms&quot;). If you do not
        agree to these Terms, you must not use the Service. These Terms
        constitute a legally binding agreement between you and NicheSurge
        (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
      </p>
      <p className="text-slate-400 leading-relaxed mb-4">
        We reserve the right to update these Terms at any time. Continued use of
        the Service after any changes constitutes your acceptance of the revised
        Terms.
      </p>

      {/* 2. Service description */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        2. Service Description
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        NicheSurge is an AI-powered YouTube niche discovery platform. The
        Service scans publicly available YouTube channel data, detects trending
        topics and viral spikes, and presents opportunity scores to help content
        creators identify potentially underserved niches.
      </p>
      <p className="text-slate-400 leading-relaxed mb-4">
        All data and insights provided by NicheSurge are{" "}
        <span className="text-slate-300 font-medium">informational only</span>.
        Nothing on the platform constitutes financial, investment, or business
        advice. Past spike patterns and opportunity scores are analytical tools,
        not guarantees of future performance or channel growth.
      </p>

      {/* 3. Subscriptions & billing */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        3. Subscriptions &amp; Billing
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        NicheSurge offers the following subscription plans:
      </p>
      <ul className="text-slate-400 leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          <span className="text-slate-300 font-medium">Free</span> — limited
          access to niche data with no charge.
        </li>
        <li>
          <span className="text-slate-300 font-medium">Basic — €9/month</span>{" "}
          — expanded niche discovery, spike alerts, and opportunity scoring.
        </li>
        <li>
          <span className="text-slate-300 font-medium">
            Premium — €19/month
          </span>{" "}
          — full access including advanced filters, trend history, and priority
          data refresh.
        </li>
      </ul>
      <p className="text-slate-400 leading-relaxed mb-4">
        All payments are processed by Stripe. By subscribing, you authorize
        Stripe to charge your payment method on a recurring basis. You may
        cancel your subscription at any time from your account settings or by
        contacting us; cancellation takes effect at the end of the current
        billing period.
      </p>
      <p className="text-slate-400 leading-relaxed mb-4">
        <span className="text-slate-300 font-medium">Refund policy:</span>{" "}
        Monthly subscriptions are non-refundable for partial billing periods.
        Annual plans are non-refundable once purchased. If you believe you were
        charged in error, contact us at vikmartin.online@gmail.com within 14
        days of the charge and we will review the case.
      </p>

      {/* 4. Acceptable use */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        4. Acceptable Use
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        You agree to use the Service only for lawful purposes and in accordance
        with these Terms. You must not:
      </p>
      <ul className="text-slate-400 leading-relaxed mb-4 list-disc list-inside space-y-2">
        <li>
          Scrape, crawl, or otherwise extract data from NicheSurge through
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
          availability, or integrity.
        </li>
      </ul>
      <p className="text-slate-400 leading-relaxed mb-4">
        Violation of these rules may result in immediate termination of your
        account without refund.
      </p>

      {/* 5. Intellectual property */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        5. Intellectual Property
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        NicheSurge and its original content, features, and functionality are
        owned by Viktor Martin and are protected by applicable intellectual
        property laws. You may not reproduce, distribute, or create derivative
        works from any part of the Service without explicit written permission.
      </p>
      <p className="text-slate-400 leading-relaxed mb-4">
        YouTube channel data displayed within the Service is sourced via the
        YouTube Data API and is subject to the{" "}
        <a
          href="https://www.youtube.com/t/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
        >
          YouTube Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
        >
          Google Privacy Policy
        </a>
        . NicheSurge does not claim ownership over any YouTube content or
        channel data.
      </p>

      {/* 6. Disclaimer */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        6. Disclaimer of Warranties
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        The Service is provided on an &quot;as is&quot; and &quot;as
        available&quot; basis without warranties of any kind, either express or
        implied, including but not limited to implied warranties of
        merchantability, fitness for a particular purpose, or non-infringement.
      </p>
      <p className="text-slate-400 leading-relaxed mb-4">
        All niche data, opportunity scores, and trend signals are informational
        tools derived from publicly available data. Past spike patterns do not
        guarantee future results. NicheSurge makes no representations about the
        accuracy, completeness, or timeliness of the data provided.
      </p>

      {/* 7. Limitation of liability */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        7. Limitation of Liability
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        To the maximum extent permitted by applicable law, NicheSurge and its
        operators shall not be liable for any indirect, incidental, special,
        consequential, or punitive damages, including but not limited to loss of
        profits, data, or goodwill, arising from your use of or inability to use
        the Service.
      </p>
      <p className="text-slate-400 leading-relaxed mb-4">
        In no event shall our total aggregate liability to you exceed the total
        amount you paid for the Service in the three (3) months immediately
        preceding the event giving rise to the claim.
      </p>

      {/* 8. Changes to terms */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        8. Changes to These Terms
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        We may update these Terms of Service from time to time to reflect
        changes in the Service, applicable law, or our business practices. When
        we make material changes, we will update the effective date at the top of
        this page. We may also notify you by email.
      </p>
      <p className="text-slate-400 leading-relaxed mb-4">
        Your continued use of the Service after the revised Terms have been
        posted constitutes your acceptance of those changes. If you do not agree
        to the revised Terms, you must stop using the Service.
      </p>

      {/* 9. Contact */}
      <h2 className="text-slate-100 font-semibold text-xl mt-10 mb-3">
        9. Contact
      </h2>
      <p className="text-slate-400 leading-relaxed mb-4">
        If you have any questions about these Terms of Service, please contact
        us at{" "}
        <a
          href="mailto:vikmartin.online@gmail.com"
          className="text-slate-300 underline underline-offset-2 hover:text-slate-100 transition-colors"
        >
          vikmartin.online@gmail.com
        </a>
        .
      </p>

      <hr className="border-slate-800 mt-12" />
    </main>
  );
}
