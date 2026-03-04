import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Check,
  X,
  ArrowRight,
  MessageSquare,
  Calendar,
  FileText,
  Shield,
  MapPin,
  Bell,
} from 'lucide-react'

const CANONICAL_URL = 'https://membercore.io/nonprofits'
const ACCENT = 'text-[#14B8A6]'
const ACCENT_BG = 'bg-[#14B8A6]'
const ACCENT_BORDER = 'border-[#14B8A6]'

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

const PROBLEM_CARDS = [
  { icon: MessageSquare, title: 'Scattered communication', desc: 'Critical updates disappear in inboxes, group chats, and social feeds.' },
  { icon: Calendar, title: 'Missed events and low turnout', desc: 'No single calendar or RSVP system everyone actually uses.' },
  { icon: FileText, title: 'Unclear access and roles', desc: 'Board, staff, volunteers, and members all mixed in the same channels.' },
  { icon: Bell, title: 'Time wasted on tools', desc: 'You spend hours stitching together email, spreadsheets, and chat apps just to stay afloat.' },
]

const STEPS = [
  { n: 1, title: 'Create your organization space', desc: 'Set up roles (board, staff, volunteers, members) and basic settings in minutes.' },
  { n: 2, title: 'Invite your people', desc: 'Share one link. Everyone joins for free and lands in the right channels and groups.' },
  { n: 3, title: 'Run your communication and events from one place', desc: 'Post announcements, schedule events, track RSVPs, and store important documents so nothing gets lost.' },
]

const FEATURE_CARDS = [
  {
    icon: Bell,
    title: 'Keep everyone in the loop',
    bullets: [
      'Member-only announcements and updates',
      'Channels for board, staff, committees, and volunteer teams',
      'Optional direct messages when people need to coordinate 1:1',
    ],
  },
  {
    icon: Calendar,
    title: 'Run better events',
    bullets: [
      'Central calendar for meetings, fundraisers, and programs',
      "Simple RSVP tracking so you know who's coming",
      'Event details visible in one place instead of scattered invites',
    ],
  },
  {
    icon: FileText,
    title: 'Store what matters',
    bullets: [
      'Bylaws, policies, meeting minutes, volunteer guides, and forms',
      'Controlled access by role so the right people see the right documents',
    ],
  },
  {
    icon: Shield,
    title: "Protect your community's trust",
    bullets: [
      'No ads, no tracking pixels, no selling member data',
      'You decide what (if anything) is public-facing',
    ],
  },
  {
    icon: MapPin,
    title: 'Optional discovery when appropriate',
    bullets: [
      'Map-based public directory and public events if you want to be found',
      'Keep internal communication and documents private',
    ],
  },
]

const CRITERIA = [
  'Coordinate members, volunteers, or chapters',
  'Host recurring events or programs',
  'Need to keep a board, staff, and community aligned',
  'Care about privacy and professionalism more than social reach',
]

const EXAMPLE_CARDS = [
  { icon: '🏢', label: 'Local and regional nonprofits' },
  { icon: '📢', label: 'Advocacy and community organizations' },
  { icon: '❤️', label: 'Cultural, heritage, and faith-based groups with formal membership' },
  { icon: '💼', label: 'Professional associations with nonprofit status' },
]

export default function Nonprofits() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Nonprofits | MemberCore'
    const link = document.createElement('link')
    link.rel = 'canonical'
    link.href = CANONICAL_URL
    link.setAttribute('data-membercore-canonical', 'nonprofits')
    document.head.appendChild(link)
    return () => {
      document.title = prevTitle
      const el = document.querySelector('link[data-membercore-canonical="nonprofits"]')
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
            Sign In
          </Link>
          <Link to="/signup">
            <Button className={`${ACCENT_BG} hover:opacity-90 text-white border-0 px-5 py-2 rounded-lg`}>
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* 1. Hero */}
      <Section className="relative text-center pt-16 md:pt-24 overflow-hidden" narrow>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-[#0A0A0F]" aria-hidden />
        <div className="relative">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6 leading-tight">
            One Secure Home for Your Nonprofit&apos;s <span className={ACCENT}>Community</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-3xl mx-auto mb-8 leading-relaxed">
            MemberCore gives nonprofits a private, organized space to communicate with members, volunteers, and supporters; run events; and share important documents without relying on ad-driven social platforms.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
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
                See How It Works
              </Button>
            </Link>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-zinc-900/80 overflow-hidden max-w-4xl mx-auto aspect-video" />
        </div>
      </Section>

      {/* 2. Problem */}
      <Section className="border-t border-white/[0.08]">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
          Too Much Mission, <span className={ACCENT}>Not Enough Infrastructure</span>
        </h2>
        <p className="text-zinc-400 max-w-3xl mb-8">
          Your job is to advance a mission, not chase down lost emails. But most nonprofits are stuck with:
        </p>
        <div className="grid sm:grid-cols-2 gap-6 mb-6">
          {PROBLEM_CARDS.map(({ icon: Icon, title, desc }) => (
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
        <p className="text-zinc-500 text-sm italic max-w-3xl">
          You feel responsible for the people who care about your mission, but your tools weren&apos;t built for structured, long-term community.
        </p>
      </Section>

      {/* 3. Guide */}
      <Section className="border-t border-white/[0.08]">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
              Built for Organizations That <span className={ACCENT}>Serve People</span>
            </h2>
            <p className="text-zinc-400 mb-4">
              Your nonprofit is more than a mailing list or a Facebook Group.
            </p>
            <p className="text-zinc-400 mb-6">
              It&apos;s a committed community of people who give their time, money, and attention. They deserve a secure, reliable place to stay informed and engaged.
            </p>
            <p className="font-medium text-white mb-3">MemberCore gives you:</p>
            <ul className="space-y-3 mb-6">
              {[
                'A private home base for your organization',
                'Clear structure for board, staff, volunteers, and members',
                'One place to manage communication, events, and key documents',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className={`h-5 w-5 shrink-0 ${ACCENT}`} />
                  <span className="text-zinc-300">{item}</span>
                </li>
              ))}
            </ul>
            <div className={`rounded-xl border-l-4 ${ACCENT_BORDER} bg-zinc-900/50 p-4`}>
              <p className="text-zinc-200 text-sm flex items-start gap-2">
                <Shield className={`h-5 w-5 shrink-0 ${ACCENT}`} />
                No ads. No selling data. No algorithms deciding who sees your mission.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-zinc-900/50 aspect-[4/3]" />
        </div>
      </Section>

      {/* 4. Plan */}
      <Section className="border-t border-white/[0.08]" narrow>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
          How Your Nonprofit Uses <span className={ACCENT}>MemberCore</span>
        </h2>
        <div className="space-y-6 mb-10">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="flex gap-4 rounded-xl border border-white/[0.08] bg-zinc-900/50 p-6"
            >
              <div className={`w-12 h-12 rounded-full ${ACCENT_BG} flex items-center justify-center shrink-0`}>
                <span className="text-lg font-bold text-white">{step.n}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link to="/signup">
            <Button
              size="lg"
              className={`${ACCENT_BG} hover:opacity-90 text-white border-0 px-8 py-6 text-lg rounded-lg justify-center gap-2`}
            >
              Start 30-Day Pro Trial (No Card)
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </Section>

      {/* 5. Features */}
      <Section className="border-t border-white/[0.08]">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
          The Private Operating System for <span className={ACCENT}>Your Nonprofit</span>
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURE_CARDS.map(({ icon: Icon, title, bullets }) => (
            <div
              key={title}
              className="rounded-xl border border-white/[0.08] bg-zinc-900/50 p-6"
            >
              <Icon className={`h-6 w-6 ${ACCENT} mb-3`} />
              <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
              <ul className="space-y-2">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-zinc-400">
                    <Check className={`h-4 w-4 shrink-0 ${ACCENT} mt-0.5`} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* 6. Who This Is For */}
      <Section className="border-t border-white/[0.08]">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
          Who This Is <span className={ACCENT}>For</span>
        </h2>
        <p className="text-zinc-400 mb-6">MemberCore is a fit if you:</p>
        <ul className="space-y-3 mb-8">
          {CRITERIA.map((c) => (
            <li key={c} className="flex items-center gap-2">
              <Check className={`h-5 w-5 shrink-0 ${ACCENT}`} />
              <span className="text-zinc-300">{c}</span>
            </li>
          ))}
        </ul>
        <p className="font-medium text-white mb-4">Examples:</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {EXAMPLE_CARDS.map(({ icon, label }) => (
            <div
              key={label}
              className="rounded-xl border border-white/[0.08] bg-zinc-900/50 p-4 flex items-center gap-3"
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-zinc-200">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 7. Pricing */}
      <Section className="border-t border-white/[0.08]">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 text-center">
          Simple Pricing. <span className={ACCENT}>Unlimited Members.</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="rounded-xl border border-white/[0.08] bg-zinc-900/50 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Starter</h3>
            <p className="text-2xl font-bold text-white mb-4">$0<span className="text-base font-normal text-zinc-400">/month</span></p>
            <ul className="space-y-3 mb-6">
              {['Free forever', 'Calendar & events', 'Events directory access'].map((t) => (
                <li key={t} className="flex items-center gap-2 text-zinc-300">
                  <Check className={`h-5 w-5 ${ACCENT}`} />
                  {t}
                </li>
              ))}
              <li className="flex items-center gap-2 text-zinc-500">
                <X className="h-5 w-5 text-red-500" />
                Read-only access to group chat & docs
              </li>
            </ul>
            <Link to="/signup">
              <Button variant="outline" className={`w-full border-2 ${ACCENT_BORDER} bg-transparent text-white hover:bg-white/10`}>
                Get Started
              </Button>
            </Link>
          </div>
          <div className={`rounded-xl border-2 ${ACCENT_BORDER} bg-zinc-900/50 p-6 relative`}>
            <div className={`absolute top-4 right-4 ${ACCENT_BG} px-3 py-1 rounded-md text-sm font-semibold text-white`}>
              Recommended
            </div>
            <h3 className="text-xl font-bold text-white mb-4">MemberCore Pro</h3>
            <p className="text-2xl font-bold text-white mb-4">$97<span className="text-base font-normal text-zinc-400">/month per org</span></p>
            <ul className="space-y-3 mb-6">
              {['Unlimited members, volunteers, and supporters', 'Full private chat & calendar', 'Directory & map (optional)', 'RSVP tracking', 'Full admin controls and permissions'].map((t) => (
                <li key={t} className="flex items-center gap-2 text-zinc-300">
                  <Check className={`h-5 w-5 ${ACCENT}`} />
                  {t}
                </li>
              ))}
            </ul>
            <Link to="/signup">
              <Button className={`w-full ${ACCENT_BG} hover:opacity-90 text-white`}>
                Start 30-Day Pro Trial (No Card)
                <ArrowRight className="h-5 w-5 ml-2 inline" />
              </Button>
            </Link>
          </div>
        </div>
      </Section>

      {/* 8. Final CTA */}
      <Section className="border-t border-white/[0.08] text-center">
        <h2 className="text-2xl md:text-4xl font-bold text-white mb-6">
          Imagine Your Nonprofit Without <span className={ACCENT}>Communication Friction</span>
        </h2>
        <ul className="space-y-3 max-w-md mx-auto mb-6">
          {[
            "Board always knows what's happening",
            'Staff and volunteers get clear, timely updates',
            'Members and supporters never have to say "I didn\'t see that"',
          ].map((item) => (
            <li key={item} className="flex items-center justify-center gap-2 text-zinc-300">
              <Check className={`h-5 w-5 shrink-0 ${ACCENT}`} />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-zinc-400 mb-8">Give your mission the infrastructure it deserves.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup">
            <Button className={`${ACCENT_BG} hover:opacity-90 text-white px-8 py-6 text-lg`}>
              Start Free
            </Button>
          </Link>
          <Link to="/signin">
            <Button variant="outline" className={`border-2 ${ACCENT_BORDER} bg-transparent text-white hover:bg-white/10 px-8 py-6 text-lg`}>
              Sign In
            </Button>
          </Link>
        </div>
      </Section>

      {/* 9. Footer */}
      <footer className="border-t border-white/[0.08] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-md ${ACCENT_BG} flex items-center justify-center text-white font-bold`}>M</div>
            <p className="text-zinc-500 text-sm">MemberCore © 2026</p>
          </div>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-zinc-500 hover:text-white text-sm">Privacy</Link>
            <a href="/terms" className="text-zinc-500 hover:text-white text-sm">Terms</a>
            <span className="text-zinc-500 text-sm">Who It&apos;s For</span>
            <span className="text-zinc-500 text-sm">Contact</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
