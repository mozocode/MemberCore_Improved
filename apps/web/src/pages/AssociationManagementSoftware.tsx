import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  CheckCircle,
  ChevronRight,
  Calendar,
  Users,
  DollarSign,
  MessageSquare,
  XCircle,
  MapPin,
  Settings,
  MessageCircle,
  ClipboardList,
  UserPlus,
} from 'lucide-react'

const CANONICAL_URL = 'https://membercore.io/association-management-software'
const BOOK_AUDIT_URL = '#book-audit'

const ORANGE = 'text-[#FF8C00]' // accent from design
const ORANGE_BG = 'bg-[#FF8C00]'
const ORANGE_BORDER = 'border-[#FF8C00]'

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

export default function AssociationManagementSoftware() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Association Management Software | MemberCore'
    const link = document.createElement('link')
    link.rel = 'canonical'
    link.href = CANONICAL_URL
    link.setAttribute('data-membercore-canonical', 'association-management-software')
    document.head.appendChild(link)
    return () => {
      document.title = prevTitle
      const el = document.querySelector('link[data-membercore-canonical="association-management-software"]')
      if (el) document.head.removeChild(el)
    }
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-zinc-800/50 sticky top-0 bg-zinc-950/90 backdrop-blur z-50">
        <Link to="/" className="text-xl font-bold text-white">
          MemberCore
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/#features" className="text-zinc-400 hover:text-white transition-colors text-sm hidden sm:inline">
            Features
          </Link>
          <Link to="/association-management-software#pricing" className="text-zinc-400 hover:text-white transition-colors text-sm hidden sm:inline">
            Pricing
          </Link>
          <Link to="/signin">
            <Button className={`${ORANGE_BG} hover:opacity-90 text-white border-0 px-5 py-2 rounded-lg`}>
              Log In
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <Section className="text-center pt-16 md:pt-24" narrow>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6 leading-tight">
          Get Your Members to Actually{' '}
          <span className={ORANGE}>See, Read, and Respond</span>
        </h1>
        <p className="text-lg md:text-xl text-zinc-400 max-w-3xl mx-auto mb-4 leading-relaxed">
          MemberCore replaces scattered communication and outdated portals with one modern hub for your association's members, events, and dues at a flat $97/month for unlimited members.
        </p>
        <p className="text-zinc-500 text-sm md:text-base mb-10">
          Built for small professional & trade associations with 50–1,000 members.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href={BOOK_AUDIT_URL}>
            <Button
              size="lg"
              className={`${ORANGE_BG} hover:opacity-90 text-white border-0 px-8 py-6 text-lg rounded-lg w-full sm:w-auto justify-center`}
            >
              Book a 20-Minute Association Ops Audit
            </Button>
          </a>
          <Link to="/signup">
            <Button
              size="lg"
              variant="outline"
              className={`border-2 ${ORANGE_BORDER} bg-transparent ${ORANGE} hover:bg-[#FF8C00]/10 px-8 py-6 text-lg rounded-lg w-full sm:w-auto justify-center`}
            >
              Start a 30-Day Free Trial
            </Button>
          </Link>
        </div>
      </Section>

      {/* You're Doing Too Much Admin */}
      <Section className="border-t border-zinc-800/50" narrow>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          You're Doing Too Much Admin, Not Enough <span className={ORANGE}>Leading</span>
        </h2>
        <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
          Running your association shouldn't feel like herding cats across five different systems.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {[
            'Renewals in spreadsheets that only one person understands',
            'Events scattered across email, Eventbrite, and social posts',
            "Members missing messages or not even knowing there's a portal",
            'Boards asking for reports you have to manually assemble every quarter',
          ].map((item, i) => (
            <div
              key={i}
              className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-5 relative overflow-hidden"
            >
              <span
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${ORANGE_BG} text-white font-bold text-sm`}
              >
                {i + 1}
              </span>
              <p className="text-zinc-300 mt-3 leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
        <p className="text-zinc-400 leading-relaxed">
          Externally, it's messy. Internally, you're wondering, "Why is this so hard just to keep members informed and paying on time?" Philosophically, it's wrong that your software punishes you for growing with per-contact pricing.
        </p>
      </Section>

      {/* Built for Associations Like Yours */}
      <Section className="border-t border-zinc-800/50">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          Built for Associations Like <span className={ORANGE}>Yours</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-zinc-400 text-lg mb-6 leading-relaxed">
              You don't need another generic "community platform." You need an operating system for your association.
            </p>
            <p className="text-zinc-400 mb-6 leading-relaxed">
              MemberCore was built specifically for small professional and trade organizations that:
            </p>
            <ul className="space-y-3 mb-6">
              {[
                'Have 50–1,000 members',
                'Run recurring events',
                'Collect dues',
                'Report to a volunteer board',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle className={`h-5 w-5 flex-shrink-0 ${ORANGE}`} />
                  <span className="text-zinc-300">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-zinc-400 leading-relaxed">
              We've taken the core workflows you do every month and put them in one modern, mobile-first platform your members will actually use.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-2xl">
            <div className="aspect-video bg-zinc-800 flex items-center justify-center p-6">
              <div className="w-full h-full rounded-lg bg-zinc-900 border border-zinc-700 flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-700">
                  <div className="w-3 h-3 rounded-full bg-zinc-600" />
                  <div className="w-3 h-3 rounded-full bg-zinc-600" />
                  <div className="w-3 h-3 rounded-full bg-zinc-600" />
                </div>
                <div className="flex flex-1 p-4 gap-4">
                  <div className="w-48 border-r border-zinc-700 space-y-2 pr-4">
                    {['Home', 'Members', 'Events', 'Dues', 'Messages'].map((label, i) => (
                      <div key={i} className="h-6 bg-zinc-800 rounded w-full max-w-[80%]" />
                    ))}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-16 bg-zinc-800 rounded" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-zinc-500 text-sm py-3 border-t border-zinc-800">
              MemberCore platform dashboard
            </p>
          </div>
        </div>
      </Section>

      {/* How You Go From Chaos to Clarity */}
      <Section id="how-it-works" className="border-t border-zinc-800/50" narrow>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
          How You Go From Chaos to <span className={ORANGE}>Clarity</span>
        </h2>
        <div className="space-y-6 mb-10">
          {[
            {
              num: 1,
              title: 'Map your current stack (20 minutes).',
              body: 'On a short Ops Audit call, we map how you currently handle members, events, and dues and show you the same flows inside MemberCore.',
            },
            {
              num: 2,
              title: 'Move your data once.',
              body: 'Import your members via CSV (name + email + optional role) and invite everyone to join in one click. Set up dues and publish your first events. Most associations are ready to go in days, not months.',
            },
            {
              num: 3,
              title: 'Run your next cycle on MemberCore.',
              body: 'Use MemberCore for renewals and your next major event cycle. If you don\'t see 80%+ deliverable emails and a 20%+ lift in RSVPs versus your last comparable event, you don\'t pay for your first 3 months.',
            },
          ].map((step) => (
            <div
              key={step.num}
              className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-6 flex gap-4 items-start"
            >
              <span
                className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${ORANGE_BG} text-white font-bold text-lg flex-shrink-0`}
              >
                {step.num}
              </span>
              <div>
                <p className="font-semibold text-white mb-2">{step.title}</p>
                <p className="text-zinc-400 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <a href={BOOK_AUDIT_URL}>
            <Button
              className={`${ORANGE_BG} hover:opacity-90 text-white border-0 px-8 py-6 text-lg rounded-lg inline-flex items-center gap-2`}
            >
              Book a 20-Minute Association Ops Audit
              <ChevronRight className="h-5 w-5" />
            </Button>
          </a>
        </div>
      </Section>

      {/* What You Get With MemberCore */}
      <Section id="features" className="border-t border-zinc-800/50">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
          What You Get With <span className={ORANGE}>MemberCore</span>
        </h2>
        <div className="grid sm:grid-cols-2 gap-6 mb-12">
          {[
            {
              icon: Users,
              title: 'One place for members',
              items: [
                'Member directory with roles and profiles',
                'Bulk import from CSV so you can onboard your whole membership in minutes',
                'Unlimited members at $97/month flat — growth is rewarded, not penalized',
              ],
            },
            {
              icon: Calendar,
              title: 'One place for events',
              items: [
                'Event creation, RSVPs, reminders, and check-ins',
                'Public and members-only events on the same calendar',
              ],
            },
            {
              icon: DollarSign,
              title: 'One place for dues and payments',
              items: [
                'Stripe-powered dues and payments',
                'Clear visibility into who\'s current and who\'s lapsed',
              ],
            },
            {
              icon: MessageSquare,
              title: 'One place for communications',
              items: [
                'Member announcements, targeted messages, and private channels',
                'Optional member chat and DMs when you\'re ready',
              ],
            },
          ].map(({ icon: Icon, title, items }) => (
            <div
              key={title}
              className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-6"
            >
              <h3 className="font-semibold text-white mb-3">{title}</h3>
              <ul className="space-y-2">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-zinc-400 text-sm">
                    <CheckCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${ORANGE}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-zinc-500 text-sm text-center mb-6">MemberCore features overview</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: MessageCircle, label: 'Member Chat' },
            { icon: Calendar, label: 'Event Calendar' },
            { icon: ClipboardList, label: 'Reporting' },
            { icon: UserPlus, label: 'Onboarding' },
            { icon: Users, label: 'Members' },
            { icon: DollarSign, label: 'Dues' },
            { icon: MapPin, label: 'Locations' },
            { icon: Settings, label: 'Settings' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]"
            >
              <div className={`p-2 rounded-lg bg-zinc-800`}>
                <Icon className={`h-6 w-6 ${ORANGE}`} />
              </div>
              <span className="text-zinc-300 text-sm text-center">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Pricing */}
      <Section id="pricing" className="border-t border-zinc-800/50" narrow>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
          Pricing: Simple and <span className={ORANGE}>Predictable</span>
        </h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-8 mb-8">
          <h3 className="font-semibold text-white text-xl mb-4">
            MemberCore Pro: $97/month per association
          </h3>
          <ul className="space-y-2 mb-6">
            {['Unlimited members', 'All core features included', 'Cancel anytime'].map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-zinc-300">
                <CheckCircle className={`h-5 w-5 flex-shrink-0 ${ORANGE}`} />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-zinc-400 text-sm mb-2">Annual plan: $970/year</p>
          <p className="text-zinc-500 text-sm mb-6">
            2 months free for prepaying the year. Preferred by boards for budgeting and reduced admin.
          </p>
          <p className={`text-center ${ORANGE} font-medium text-sm`}>
            If your next major event doesn't get at least 20% more RSVPs than your last comparable event, you don't pay for your first 3 months.
          </p>
        </div>
        <div className="text-center">
          <Link to="/signup">
            <Button
              className={`${ORANGE_BG} hover:opacity-90 text-white border-0 px-8 py-6 text-lg rounded-lg inline-flex items-center gap-2`}
            >
              See Pricing & Start Your 30-Day Free Trial
              <ChevronRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </Section>

      {/* The Stakes */}
      <Section className="border-t border-zinc-800/50" narrow>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
          The Stakes: What Happens If You <span className={ORANGE}>Don't Change</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6">
            <p className="font-semibold text-white mb-4">If nothing changes:</p>
            <ul className="space-y-2 text-zinc-400 text-sm">
              {[
                'Staff stay buried in spreadsheets and manual reports',
                'Members continue missing events and lapsing quietly',
                'Boards keep questioning the value of your tech stack',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6">
            <p className="font-semibold text-white mb-4">If you switch:</p>
            <ul className="space-y-2 text-zinc-300 text-sm">
              {[
                'You get a single, modern system your team can actually manage',
                'Members see a clear calendar, clear dues, and clear communication',
                'Your board sees clean, simple reports instead of excuses',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-xl md:text-2xl font-bold text-white text-center mb-2">
          You don't need a bigger staff or a bigger budget. You need a better system.
        </p>
        <p className="text-zinc-400 text-center mb-8">
          Move your members once with a simple CSV import. If it doesn't increase engagement and RSVPs, you don't pay.
        </p>
        <p className="text-zinc-500 text-center mb-6">Next step:</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href={BOOK_AUDIT_URL}>
            <Button
              size="lg"
              className={`${ORANGE_BG} hover:opacity-90 text-white border-0 px-8 py-6 text-lg rounded-lg w-full sm:w-auto`}
            >
              Book a 20-Minute Association Ops Audit
            </Button>
          </a>
          <Link to="/signup">
            <Button
              size="lg"
              variant="outline"
              className={`border-2 ${ORANGE_BORDER} bg-transparent ${ORANGE} hover:bg-[#FF8C00]/10 px-8 py-6 text-lg rounded-lg w-full sm:w-auto`}
            >
              Start a 30-Day Free Trial
            </Button>
          </Link>
        </div>
      </Section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-400">MemberCore.io</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-sm text-zinc-400 hover:text-white">
              Privacy
            </Link>
            <Link to="/" className="text-sm text-zinc-400 hover:text-white">
              Terms
            </Link>
            <a href="mailto:support@membercore.io" className="text-sm text-zinc-400 hover:text-white">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
