import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Check,
  X,
  ArrowRight,
  DollarSign,
  MessageSquare,
  Zap,
  Shield,
  Users,
  MessageCircle,
  Calendar,
  FileText,
  MapPin,
  Lock,
  TrendingUp,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'

const CANONICAL_URL = 'https://membercore.io/compare/wild-apricot'
const ACCENT = 'text-[#FF8C00]'
const ACCENT_BG = 'bg-[#FF8C00]'
const ACCENT_BORDER = 'border-[#FF8C00]'

function Section({
  children,
  className = '',
  id,
  narrow,
}: {
  children: React.ReactNode
  className?: string
  id?: string
  narrow?: boolean
}) {
  return (
    <section
      id={id}
      className={`py-16 md:py-24 px-6 ${narrow ? 'max-w-4xl' : 'max-w-6xl'} mx-auto ${className}`}
    >
      {children}
    </section>
  )
}

const FEATURE_ROWS: { feature: string; mc: string; wa: string; highlight?: boolean }[] = [
  { feature: 'Total cost at 400 members', mc: '$97/month', wa: '~$190/month', highlight: true },
  { feature: 'Pricing model', mc: 'Flat rate, unlimited', wa: 'Per-contact scaling', highlight: true },
  { feature: 'Private group chat & DMs', mc: '✓', wa: '✗', highlight: true },
  { feature: 'Mobile-first design', mc: '✓', wa: '✗', highlight: true },
  { feature: 'Event calendar & RSVPs', mc: '✓', wa: '✓' },
  { feature: 'Document storage by role', mc: '✓', wa: 'Limited' },
  { feature: 'Dues & payments (Stripe)', mc: '✓', wa: 'Built-in (higher fees)' },
  { feature: 'Member directory & map', mc: '✓', wa: 'Basic directory' },
  { feature: 'No ads or tracking', mc: '✓', wa: '✗' },
  { feature: 'Admin controls & roles', mc: '✓', wa: '✓' },
  { feature: 'Public event discovery', mc: 'Optional', wa: 'Limited' },
  { feature: 'Setup time', mc: 'Minutes', wa: 'Days to weeks' },
  { feature: 'Free trial', mc: '30 days, no card', wa: '30 days' },
]

const WHY_SWITCH = [
  {
    icon: DollarSign,
    title: 'Per-contact pricing punishes growth',
    desc: "Every new member makes your bill bigger. With MemberCore, it's $97/month flat — so you can grow without asking 'Can we afford more contacts?'",
  },
  {
    icon: MessageSquare,
    title: 'No built-in private communication',
    desc: "With Wild Apricot, you still need email + Facebook for real engagement. MemberCore gives you channels and DMs so member conversations actually happen in one place.",
  },
  {
    icon: Zap,
    title: 'Dated interface, slow setup',
    desc: "Members struggle to navigate Wild Apricot's UI. Admins spend hours configuring basic features instead of running programs and building engagement.",
  },
  {
    icon: Shield,
    title: 'Ads and tracking on lower tiers',
    desc: "Wild Apricot shows ads on your site unless you pay premium. MemberCore never shows ads or tracks your members — your association's brand stays clean.",
  },
]

const WHAT_YOU_GET = [
  { icon: Users, title: 'Unlimited members', desc: 'No per-contact pricing. Add as many members as your association needs.' },
  { icon: MessageCircle, title: 'Private chat & channels', desc: 'Built-in group chat, DMs, and organized channels for committees and boards.' },
  { icon: Calendar, title: 'Events & RSVPs', desc: 'Central calendar with RSVP tracking your members will actually use.' },
  { icon: FileText, title: 'Document storage', desc: 'Bylaws, minutes, and forms with role-based access control.' },
  { icon: MapPin, title: 'Directory & map', desc: 'Optional public directory and map-based discovery for your association.' },
  { icon: Lock, title: 'Privacy by default', desc: 'No ads, no tracking, no algorithms. You control visibility.' },
]

export default function CompareWildApricot() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = 'MemberCore vs Wild Apricot | Comparison'
    const link = document.createElement('link')
    link.rel = 'canonical'
    link.href = CANONICAL_URL
    link.setAttribute('data-membercore-canonical', 'compare-wild-apricot')
    document.head.appendChild(link)
    return () => {
      document.title = prevTitle
      const el = document.querySelector('link[data-membercore-canonical="compare-wild-apricot"]')
      if (el) document.head.removeChild(el)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/[0.08] sticky top-0 bg-[#0A0A0F]/95 backdrop-blur z-50">
        <Link to="/" className="text-xl font-bold text-white">
          MemberCore
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/signin" className="text-zinc-400 hover:text-white transition-colors text-sm">
            Login
          </Link>
          <Link to="/signup">
            <Button className={`${ACCENT_BG} hover:opacity-90 text-white border-0 px-5 py-2 rounded-lg`}>
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* 1. Hero */}
      <Section className="text-center pt-16 md:pt-24" narrow>
        <p className={`text-xs font-bold uppercase tracking-widest ${ACCENT} mb-4`}>
          MemberCore vs Wild Apricot
        </p>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6 leading-tight">
          Stop Paying Wild Apricot More As Your{' '}
          <span className={ACCENT}>Association Grows</span>
        </h1>
        <p className="text-lg text-zinc-400 max-w-3xl mx-auto mb-8 leading-relaxed">
          Small professional & trade associations use MemberCore to replace Wild Apricot&apos;s per-contact pricing with a flat $97/month for unlimited members, built-in private chat, events, and documents.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <Link to="/signup">
            <Button
              size="lg"
              className={`${ACCENT_BG} hover:opacity-90 text-white border-0 px-8 py-6 text-lg rounded-lg w-full sm:w-auto justify-center gap-2`}
            >
              Start 30-Day Pro Trial (No Card)
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/signin">
            <Button
              size="lg"
              variant="outline"
              className={`border-2 ${ACCENT_BORDER} bg-transparent text-white hover:bg-white/10 px-8 py-6 text-lg rounded-lg w-full sm:w-auto justify-center`}
            >
              See the Platform
            </Button>
          </Link>
        </div>
        <p className="text-sm italic text-zinc-500 max-w-2xl mx-auto">
          Move your association over in 30 days. If your next major event doesn&apos;t get at least 20% more RSVPs than your last comparable event, you don&apos;t pay for the first 3 months.
        </p>
      </Section>

      {/* 2. Pricing comparison cards */}
      <Section className="border-t border-white/[0.08]">
        <div className="grid md:grid-cols-2 gap-6">
          <div className={`rounded-xl border-2 ${ACCENT_BORDER} bg-zinc-900/80 p-6 relative overflow-hidden`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${ACCENT_BG}`} />
            <div className={`w-10 h-10 rounded-lg ${ACCENT_BG} flex items-center justify-center text-white font-bold text-lg mb-4`}>
              M
            </div>
            <p className="text-zinc-400 text-sm mb-1">Flat rate, unlimited</p>
            <p className="text-2xl font-bold text-white mb-4">$97<span className="text-lg font-normal text-zinc-400">/month</span></p>
            <ul className="space-y-3">
              {['Unlimited members', 'Private chat & DMs', 'Events, docs, directory', 'No per-contact fees ever'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-zinc-200">
                  <Check className={`h-5 w-5 shrink-0 ${ACCENT}`} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-zinc-900/50 p-6 opacity-90">
            <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-300 font-bold text-sm mb-4">
              WA
            </div>
            <p className="text-zinc-400 text-sm mb-1">Per-contact pricing</p>
            <p className="text-2xl font-bold text-white mb-4">$60–$360+<span className="text-lg font-normal text-zinc-400">/month</span></p>
            <ul className="space-y-3">
              {[
                { text: 'Price increases as you grow', ok: false },
                { text: 'No built-in private chat', ok: false },
                { text: 'Events & basic directory', ok: true },
                { text: 'Ads on free/lower tiers', ok: false },
              ].map(({ text, ok }) => (
                <li key={text} className="flex items-center gap-2 text-zinc-200">
                  {ok ? (
                    <Check className="h-5 w-5 shrink-0 text-zinc-500" />
                  ) : (
                    <X className="h-5 w-5 shrink-0 text-red-500" />
                  )}
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* 3. Why Small Associations Switch */}
      <Section className="border-t border-white/[0.08]">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
          Why Small Associations Switch from <span className={ACCENT}>Wild Apricot</span>
        </h2>
        <p className="text-zinc-400 max-w-3xl mb-10">
          Wild Apricot works for basic websites and contact management. But when your association needs real engagement, higher event turnout, and less admin overhead, it starts to fall short.
        </p>
        <div className="grid sm:grid-cols-2 gap-6">
          {WHY_SWITCH.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-white/[0.08] bg-zinc-900/50 p-6"
            >
              <Icon className={`h-6 w-6 ${ACCENT} mb-3`} />
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 4. Feature-by-feature table */}
      <Section className="border-t border-white/[0.08]">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          Feature-by-Feature <span className={ACCENT}>Comparison</span>
        </h2>
        <div className="rounded-xl border border-white/[0.08] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-800/80 border-b border-white/[0.08]">
                <th className="py-3 px-4 font-semibold text-white">Feature</th>
                <th className="py-3 px-4 font-semibold text-white">MemberCore</th>
                <th className="py-3 px-4 font-semibold text-white">Wild Apricot</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr
                  key={row.feature}
                  className={`border-b border-white/[0.06] ${row.highlight ? 'bg-[#FF8C00]/5' : ''}`}
                >
                  <td className="py-3 px-4 text-zinc-200 font-medium">{row.feature}</td>
                  <td className="py-3 px-4">
                    {row.mc === '✓' ? (
                      <Check className={`h-5 w-5 ${ACCENT}`} />
                    ) : (
                      <span className="text-white font-medium">{row.mc}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {row.wa === '✗' ? (
                      <X className="h-5 w-5 text-red-500" />
                    ) : (
                      <span className="text-zinc-300">{row.wa}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 5. What You Get When You Switch */}
      <Section className="border-t border-white/[0.08]">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          What You Get When You <span className={ACCENT}>Switch</span>
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {WHAT_YOU_GET.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-white/[0.08] bg-zinc-900/50 p-6"
            >
              <Icon className={`h-6 w-6 ${ACCENT} mb-3`} />
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 6. Testimonial */}
      <Section className="border-t border-white/[0.08]" narrow>
        <div className={`rounded-xl border-l-4 ${ACCENT_BORDER} bg-zinc-900/50 p-8 text-center`}>
          <TrendingUp className={`h-10 w-10 mx-auto mb-4 ${ACCENT}`} />
          <blockquote className="text-xl md:text-2xl italic text-white mb-4 leading-relaxed">
            &ldquo;After switching from Wild Apricot to MemberCore, our association cut our monthly software bill by 40% and increased RSVPs for our quarterly meeting by 27%.&rdquo;
          </blockquote>
          <p className="text-zinc-500 text-sm">
            — Executive Director, Regional Professional Association
          </p>
        </div>
      </Section>

      {/* 7. Stay vs Switch */}
      <Section className="border-t border-white/[0.08]">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
          What Happens If You <span className={ACCENT}>Stay vs Switch</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/[0.08] bg-zinc-900/50 p-6">
            <AlertTriangle className="h-8 w-8 text-red-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-4">Stay on Wild Apricot</h3>
            <ul className="space-y-3">
              {[
                'Your bill keeps growing with every new member you recruit',
                'Members still rely on email and Facebook — engagement stays flat',
                "You keep stitching together tools that don't talk to each other",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
                  <span className="text-zinc-300 text-sm">{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={`rounded-xl border-2 ${ACCENT_BORDER} bg-zinc-900/50 p-6`}>
            <Sparkles className={`h-8 w-8 ${ACCENT} mb-4`} />
            <h3 className="text-xl font-bold text-white mb-4">Switch to MemberCore</h3>
            <ul className="space-y-3">
              {[
                'One flat price no matter how many members your association has',
                'Real communication tools that drive engagement and event turnout',
                'Everything in one place: chat, events, docs, directory',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className={`h-5 w-5 shrink-0 ${ACCENT} mt-0.5`} />
                  <span className="text-zinc-300 text-sm">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* 8. Final CTA */}
      <Section className="border-t border-white/[0.08] text-center">
        <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
          Ready to Replace Wild Apricot with <span className={ACCENT}>Something Better?</span>
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto mb-8">
          Try MemberCore free for 30 days. No credit card required. Import your members and see the difference in your next event.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup">
            <Button
              size="lg"
              className={`${ACCENT_BG} hover:opacity-90 text-white border-0 px-8 py-6 text-lg rounded-lg w-full sm:w-auto justify-center gap-2`}
            >
              Start 30-Day Pro Trial (No Card)
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/signin">
            <Button
              size="lg"
              variant="outline"
              className={`border-2 ${ACCENT_BORDER} bg-transparent text-white hover:bg-white/10 px-8 py-6 text-lg rounded-lg w-full sm:w-auto justify-center`}
            >
              See the Platform
            </Button>
          </Link>
        </div>
      </Section>

      {/* 9. Footer */}
      <footer className="border-t border-white/[0.08] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-zinc-500 text-sm">© {new Date().getFullYear()} MemberCore</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-zinc-500 hover:text-white text-sm">
              Privacy
            </Link>
            <a href="/terms" className="text-zinc-500 hover:text-white text-sm">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
