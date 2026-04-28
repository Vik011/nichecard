'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function LandingPage() {
  const [lang, setLang] = useState<'EN' | 'DE'>('EN')

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <span className="text-xl font-extrabold tracking-tight text-white">
          Niche<span className="text-indigo-400">Surge</span>
        </span>
        <div className="flex items-center gap-3">
          {/* Language switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            {(['EN', 'DE'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  lang === l
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <Link href="/discover/shorts" className="text-slate-400 hover:text-white text-sm transition-colors">
            Discover
          </Link>
          <Link
            href="/discover/shorts"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative text-center px-6 pt-16 pb-28 max-w-5xl mx-auto">
        {/* Glow bg */}
        <div className="absolute inset-0 -z-10 flex justify-center items-start pt-8 pointer-events-none">
          <div className="w-[600px] h-[300px] bg-indigo-600/20 rounded-full blur-[120px]" />
        </div>

        <div className="inline-flex items-center gap-2 bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-xs font-semibold px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Live niche scanner — updated every hour
        </div>

        <h1 className="text-6xl font-extrabold leading-[1.1] text-white mb-6 tracking-tight">
          Discover Viral YouTube<br />
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            Niches Before Anyone Else
          </span>
        </h1>

        <p className="text-slate-400 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          NicheSurge scans YouTube in real time to find Shorts and Longform niches that are spiking right now — before they go mainstream.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/discover/shorts"
            className="group relative inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-2xl shadow-indigo-900/50 hover:shadow-indigo-700/40 hover:-translate-y-0.5"
          >
            Start Discovering — Free
            <span className="text-indigo-200 group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center justify-center border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold px-8 py-4 rounded-xl text-base transition-all hover:bg-slate-900"
          >
            View Pricing
          </a>
        </div>

        {/* Social proof */}
        <p className="text-slate-600 text-xs mt-8">No credit card required · Cancel anytime</p>
      </section>

      {/* Feature highlights */}
      <section className="border-y border-slate-800/60 bg-slate-900/30 py-10">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 px-6 text-center">
          {[
            { icon: '⚡', value: 'Every Hour', label: 'Scan Frequency' },
            { icon: '📈', value: 'Spike ×20+', label: 'Mega Niche Alert' },
            { icon: '🌍', value: 'EN & DE', label: 'Languages' },
            { icon: '🎯', value: '100-Point', label: 'Opportunity Score' },
          ].map(stat => (
            <div key={stat.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl">{stat.icon}</span>
              <p className="text-lg font-bold text-white">{stat.value}</p>
              <p className="text-slate-500 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-24 max-w-5xl mx-auto">
        <p className="text-indigo-400 text-sm font-semibold text-center uppercase tracking-widest mb-3">How It Works</p>
        <h2 className="text-4xl font-bold text-center text-white mb-14">From Scan to Viral in 3 Steps</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              icon: '🔍',
              title: 'We Scan YouTube',
              desc: 'Our scanner runs every hour, analyzing thousands of channels to detect subscriber and view spikes across Shorts and Longform niches.',
            },
            {
              step: '02',
              icon: '📊',
              title: 'You Discover Niches',
              desc: 'Filter by subscriber range, channel age, and virality. See opportunity scores, spike multipliers, and channel metrics in real time.',
            },
            {
              step: '03',
              icon: '🚀',
              title: 'You Create & Win',
              desc: 'Jump in early before the niche saturates. Premium users get AI-powered content ideas, thumbnail concepts, and early warning alerts.',
            },
          ].map(item => (
            <div
              key={item.step}
              className="relative bg-slate-900 border border-slate-800 hover:border-indigo-800/60 rounded-2xl p-7 transition-colors group"
            >
              <div className="absolute top-5 right-5 text-4xl font-extrabold text-slate-800 group-hover:text-indigo-900/60 transition-colors">
                {item.step}
              </div>
              <div className="text-3xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-24 bg-gradient-to-b from-slate-900/0 via-slate-900/40 to-slate-900/0">
        <div className="max-w-5xl mx-auto">
          <p className="text-indigo-400 text-sm font-semibold text-center uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="text-4xl font-bold text-center text-white mb-3">Simple, Transparent Pricing</h2>
          <p className="text-slate-400 text-center mb-14">Start free. Upgrade when you&apos;re ready.</p>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {/* Free */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 flex flex-col">
              <div className="mb-7">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Free</span>
                <div className="flex items-end gap-1 mt-3">
                  <p className="text-5xl font-extrabold text-white">€0</p>
                </div>
                <p className="text-slate-500 text-sm mt-1">forever</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  '3 searches per day',
                  'Up to 5 niches per search',
                  'Opportunity score & spike data',
                  'Channel name & link hidden',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <span className="text-slate-600 mt-0.5 shrink-0">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/discover/shorts"
                className="w-full text-center border border-slate-700 hover:border-indigo-500 hover:text-indigo-300 text-slate-400 font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                Get Started Free
              </Link>
            </div>

            {/* Basic */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 flex flex-col">
              <div className="mb-7">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Basic</span>
                <div className="flex items-end gap-1 mt-3">
                  <p className="text-5xl font-extrabold text-white">€9</p>
                  <p className="text-slate-500 text-sm mb-2">/mo</p>
                </div>
                <p className="text-slate-500 text-sm mt-1">billed monthly</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  '20 searches per day',
                  'Up to 20 niches per search',
                  'Full channel details unlocked',
                  'Channel name, niche & link',
                  'Views & engagement rate',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <span className="text-indigo-400 mt-0.5 shrink-0">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/discover/shorts"
                className="w-full text-center bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                Get Basic
              </Link>
            </div>

            {/* Premium */}
            <div className="relative bg-gradient-to-b from-indigo-950 to-slate-950 border-2 border-indigo-500/70 rounded-2xl p-7 flex flex-col shadow-2xl shadow-indigo-950/60">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                  MOST POPULAR
                </span>
              </div>
              <div className="mb-7">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Premium</span>
                <div className="flex items-end gap-1 mt-3">
                  <p className="text-5xl font-extrabold text-white">€19</p>
                  <p className="text-indigo-300/60 text-sm mb-2">/mo</p>
                </div>
                <p className="text-indigo-300/50 text-sm mt-1">billed monthly</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  'Unlimited searches',
                  'Up to 50 niches per search',
                  'Everything in Basic',
                  '🤖 AI Clone & Twist ideas',
                  '🤖 5 Shorts ideas per niche',
                  '🤖 Thumbnail concept suggestions',
                  '🔔 Early Warning alerts',
                  '📊 Niche Health Check',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-indigo-100">
                    <span className="text-indigo-400 mt-0.5 shrink-0">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/discover/shorts"
                className="w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/50 text-sm"
              >
                Get Premium
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative px-6 py-28 text-center max-w-3xl mx-auto">
        <div className="absolute inset-0 -z-10 flex justify-center items-center pointer-events-none">
          <div className="w-[500px] h-[200px] bg-indigo-700/15 rounded-full blur-[100px]" />
        </div>
        <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
          Ready to Find Your Niche?
        </h2>
        <p className="text-slate-400 text-lg mb-10">
          Join creators who discover viral opportunities before everyone else.
        </p>
        <Link
          href="/discover/shorts"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-10 py-4 rounded-xl text-base transition-all shadow-2xl shadow-indigo-900/50 hover:-translate-y-0.5"
        >
          Start Discovering — Free
          <span>→</span>
        </Link>
        <p className="text-slate-600 text-xs mt-5">No credit card required · Cancel anytime</p>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-slate-600 text-sm">
            © 2026 Niche<span className="text-indigo-500">Surge</span>. All rights reserved.
          </span>
          <div className="flex gap-6 text-slate-500 text-sm">
            <Link href="/discover/shorts" className="hover:text-slate-300 transition-colors">Shorts</Link>
            <Link href="/discover/longform" className="hover:text-slate-300 transition-colors">Longform</Link>
            <a href="#pricing" className="hover:text-slate-300 transition-colors">Pricing</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
