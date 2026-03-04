import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Check,
  X,
  ArrowRight,
  MessageSquare,
  Calendar,
  Users,
  Clock,
  FileText,
  Shield,
  MapPin,
  Bell,
  Award,
  GraduationCap,
} from 'lucide-react'

const CANONICAL_URL = 'https://membercore.io/sports-clubs'
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
  { icon: MessageSquare, title: 'Lost messages', desc: 'Important messages getting lost in text threads and chat apps.' },
  { icon: Calendar, title: 'Missed changes', desc: 'Practice and game changes not reaching everyone in time.' },
  { icon: Users, title: 'Repeated questions', desc: 'Parents asking the same questions over and over.' },
  { icon: Clock, title: 'Wasted hours', desc: 'Coaches and organizers wasting hours sending reminders and updates.' },
]

const STEPS = [
  { n: 1, title: 'Create your club space', desc: 'Set up your club in minutes and create channels for teams, age groups, and coaches.' },
  { n: 2, title: 'Invite players and parents', desc: 'Share one link. Everyone joins free and lands in the right place.' },
  { n: 3, title: 'Run your season from one app', desc: 'Post announcements, schedule games and practices, track RSVPs, and share documents so nothing gets missed.' },
]

const FEATURE_CARDS = [
  {
    icon: Bell,
    title: 'Keep everyone in the loop',
    bullets: [
      "Announcements that don't get buried in text chains",
      'Channels for whole club, specific teams, and coaches',
      'Optional direct messages when 1:1 coordination is needed',
    ],
  },
  {
    icon: Calendar,
    title: 'Run better schedules',
    bullets: [
      'Central calendar for games, practices, and club events',
      "Simple RSVP tracking so you know who's coming",
      'Updates in one place when times or fields change',
    ],
  },
  {
    icon: FileText,
    title: 'Share what matters',
    bullets: [
      'Club rules, waivers, schedules, and tournament info',
      'Controlled access so only the right people see the right documents',
    ],
  },
  {
    icon: Shield,
    title: 'Protect your community',
    bullets: [
      'No ads or tracking pixels aimed at your families',
      "You decide what (if anything) is public-facing",
    ],
  },
  {
    icon: MapPin,
    title: 'Optional public presence',
    bullets: [
      'Map-based public listing and public events if you want to be found',
      'Keep internal communication completely private',
    ],
  },
]

const CRITERIA = [
  'Run a small sports club or league',
  'Coordinate multiple teams, coaches, or age groups',
  'Need to keep players and parents updated',
  'Care about privacy and simplicity more than social media',
]

const EXAMPLE_CARDS = [
  { icon: Award, label: 'Youth sports clubs and academies' },
  { icon: Users, label: 'Adult recreational leagues and teams' },
  { icon: GraduationCap, label: 'Community and school-based sports organizations' },
]

export default function SportsClubs() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Sports Clubs | MemberCore'
    const link = document.createElement('link')
    link.rel = 'canonical'
    link.href = CANONICAL_URL
    link.setAttribute('data-membercore-canonical', 'sports-clubs')
    document.head.appendChild(link)
    return () => {
      document.title = prevTitle
      const el = document.querySelector('link[data-membercore-canonical="sports-clubs"]')
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

      {/* 1. Hero with gradient overlay */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-b from-[rgba(10,10,15,0.5)] to-[#0A0A0F]"
          aria-hidden
        />
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6 leading-tight">
            One Home for Your Sports Club&apos;s{' '}
            <span className={ACCENT}>Players, Parents, and Coaches</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-3xl mx-auto mb-8 leading-relaxed">
            MemberCore gives small sports clubs a private, organized place to share updates, manage events, and keep everyone on the same page – without chasing texts, emails, and group chats.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <Link to="/signup">
              <Button
                size="lg"
                className={`${ACCENT_BG} hover:opacity-90 text-white border-0 px-8 py-6 text-lg rounded-lg w-full sm:w-auto justify-center gap-2 shadow-lg shadow-[#14B8A6]/20`}
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
          <div className="rounded-xl border border-[#14B8A6]/30 bg-zinc-900/80 overflow-hidden max-w-4xl mx-auto aspect-video shadow-lg shadow-[#14B8A6]/10" />
        </div>
      </section>

      {/* 2. Problem */}
      <Section className="border-t border-white/[0.08]">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
          Games Are Simple, <span className={ACCENT}>Communication Isn&apos;t</span>
        </h2>
        <p className="text-zinc-400 max-w-3xl mb-8">
          Running a team or club is supposed to be fun. Instead, it often feels like:
        </p>
        <div className="grid sm:grid-cols-2 gap-6 mb-6">
          {PROBLEM_CARDS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-white/[0.08] bg-[#12121A] p-6"
            >
              <Icon className={`h-6 w-6 ${ACCENT} mb-3`} />
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-zinc-500 text-sm italic max-w-3xl">
          You signed up to develop players and build community, not manage six different apps and spreadsheets.
        </p>
      </Section>

      {/* 3. Guide */}
      <Section className="border-t border-white/[0.08]">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
              Built for Clubs That <span className={ACCENT}>Actually Play Together</span>
            </h2>
            <p className="text-zinc-400 mb-4">
              Your sports club is more than a text thread.
            </p>
            <p className="text-zinc-400 mb-6">
              It&apos;s coaches, players, and parents who all need clear, reliable information in one place.
            </p>
            <p className="font-medium text-white mb-3">MemberCore gives you:</p>
            <ul className="space-y-3 mb-6">
              {[
                'One private home for your club',
                'Clear structure for teams, age groups, and roles',
                'A simple way to run communication and events from one place',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className={`h-5 w-5 shrink-0 ${ACCENT}`} />
                  <span className="text-zinc-300">{item}</span>
                </li>
              ))}
            </ul>
            <div className={`rounded-xl border-l-4 ${ACCENT_BORDER} bg-[#12121A] p-4`}>
              <p className="text-zinc-200 text-sm flex items-start gap-2">
                <Shield className={`h-5 w-5 shrink-0 ${ACCENT}`} />
                No ads. No algorithms. No guessing who saw what.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#12121A] aspect-[4/3]" />
        </div>
      </Section>

      {/* 4. Plan */}
      <Section className="border-t border-white/[0.08]" narrow>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
          How Your Club Uses <span className={ACCENT}>MemberCore</span>
        </h2>
        <div className="space-y-6 mb-10 max-w-2xl mx-auto">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="flex gap-4 rounded-xl border border-white/[0.08] bg-[#12121A] p-6"
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
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
          The Private Operating System for <span className={ACCENT}>Your Club</span>
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURE_CARDS.map(({ icon: Icon, title, bullets }) => (
            <div
              key={title}
              className="rounded-xl border border-white/[0.08] bg-[#12121A] p-6"
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

      {/* 6. Who It's For */}
      <Section className="border-t border-white/[0.08]">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
          Who MemberCore Is <span className={ACCENT}>For</span>
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
        <div className="grid sm:grid-cols-3 gap-4">
          {EXAMPLE_CARDS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="rounded-xl border border-white/[0.08] bg-[#12121A] p-4 flex items-center gap-3"
            >
              <Icon className={`h-6 w-6 ${ACCENT} shrink-0`} />
              <span className="text-zinc-200 text-sm">{label}</span>
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
          <div className="rounded-xl border border-white/[0.08] bg-[#12121A] p-6">
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
          <div className={`rounded-xl border-2 ${ACCENT_BORDER} bg-[#12121A] p-6 relative`}>
            <div className={`absolute top-4 right-4 ${ACCENT_BG} px-3 py-1 rounded-md text-sm font-semibold text-white`}>
              Recommended
            </div>
            <h3 className="text-xl font-bold text-white mb-4">MemberCore Pro</h3>
            <p className="text-2xl font-bold text-white mb-4">$97<span className="text-base font-normal text-zinc-400">/month per org</span></p>
            <ul className="space-y-3 mb-6">
              {['Unlimited players, parents, and coaches', 'Full private chat & calendar', 'Directory & map (optional)', 'RSVP tracking', 'Full admin controls and permissions'].map((t) => (
                <li key={t} className="flex items-center gap-2 text-zinc-300">
                  <Check className={`h-5 w-5 ${ACCENT}`} />
                  {t}
                </li>
              ))}
            </ul>
            <Link to="/signup">
              <Button className={`w-full ${ACCENT_BG} hover:opacity-90 text-white shadow-lg shadow-[#14B8A6]/20`}>
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
          Imagine Your Club Without <span className={ACCENT}>Communication Chaos</span>
        </h2>
        <ul className="space-y-3 max-w-md mx-auto mb-6">
          {[
            'Parents know exactly where to look for updates',
            'Coaches stop repeating the same information',
            'Players and families show up on time, in the right place',
          ].map((item) => (
            <li key={item} className="flex items-center justify-center gap-2 text-zinc-300">
              <Check className={`h-5 w-5 shrink-0 ${ACCENT}`} />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-zinc-400 mb-8">Give your club a home that&apos;s built for how you actually play and organize.</p>
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
            <p className="text-zinc-500 text-sm">MemberCore © 2025</p>
          </div>
          <div className="flex gap-6 flex-wrap justify-center">
            <Link to="/" className="text-zinc-500 hover:text-white text-sm">Home</Link>
            <span className="text-zinc-500 text-sm">Features</span>
            <span className="text-zinc-500 text-sm">Pricing</span>
            <Link to="/support" className="text-zinc-500 hover:text-white text-sm">Support</Link>
            <a href="/terms" className="text-zinc-500 hover:text-white text-sm">Terms</a>
            <Link to="/privacy" className="text-zinc-500 hover:text-white text-sm">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
