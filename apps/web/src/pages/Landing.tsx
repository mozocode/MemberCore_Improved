import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  MessageSquare,
  FileText,
  User,
  Clock,
  CheckCircle,
  Calendar,
  MapPin,
  Settings,
  Users,
  Lock,
  BarChart3,
  ChevronRight,
  MessageCircle,
  FolderOpen,
} from 'lucide-react'

function Section({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <section
      id={id}
      className={`py-16 md:py-24 px-6 max-w-6xl mx-auto ${className}`}
    >
      {children}
    </section>
  )
}

function SectionHeading({
  line1,
  highlight,
}: {
  line1: string
  highlight: string
}) {
  return (
    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6">
      {line1} <span className="text-brand-orange">{highlight}</span>
    </h2>
  )
}

export function Landing() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 sticky top-0 bg-black/80 backdrop-blur z-50">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-brand-orange flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-xl font-bold">MemberCore</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-zinc-400 hover:text-white transition-colors">
            Product
          </a>
          <a href="#pricing" className="text-zinc-400 hover:text-white transition-colors">
            Pricing
          </a>
          <a href="#built-for" className="text-zinc-400 hover:text-white transition-colors">
            Who's it for
          </a>
          <Link to="/signin" className="text-zinc-400 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link to="/signup">
            <Button className="bg-brand-orange hover:bg-brand-orange/90 text-white border-0">
              Start Free
            </Button>
          </Link>
        </div>
        <div className="flex md:hidden gap-2">
          <Link to="/signin">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link to="/signup">
            <Button size="sm" className="bg-brand-orange hover:bg-brand-orange/90 text-white border-0">
              Start Free
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <Section className="text-center pt-20">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
          One Platform for
        </h1>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-brand-orange mb-6">
          Your Members
        </h1>
        <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-8">
          Communication, events, documents, and controlled visibility — built for structure, privacy,
          and real engagement.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Link to="/signup">
            <Button
              size="lg"
              className="bg-brand-orange hover:bg-brand-orange/90 text-white border-0 px-8 py-6 text-lg rounded-lg flex items-center gap-2"
            >
              Start 30-day Pro trial (no card)
              <ChevronRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="#features">
            <Button
              size="lg"
              variant="outline"
              className="border-zinc-600 text-white hover:bg-zinc-800 px-8 py-6 text-lg rounded-lg"
            >
              See the platform
            </Button>
          </Link>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          {['Unlimited Members', 'Private Chat + docs', 'Optional Discovery'].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-brand-orange flex-shrink-0" />
              <span className="text-zinc-400">{item}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Tools That Weren't Built for Membership */}
      <Section id="features">
        <SectionHeading line1="Tools That Weren't Built for" highlight="Membership" />
        <p className="text-zinc-400 text-lg max-w-3xl mb-12">
          Leaders are expected to keep people informed, connected, and engaged. But the tools
          available today make this harder than it should be.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              icon: MessageSquare,
              title: 'Scattered messages',
              desc: 'Critical updates get lost in group chats.',
            },
            {
              icon: Calendar,
              title: 'Missed events',
              desc: 'No centralized calendar or RSVP tracking.',
            },
            {
              icon: User,
              title: 'Wrong audience',
              desc: 'Messages reach the wrong people or reach nobody.',
            },
            {
              icon: Clock,
              title: 'Time wasted',
              desc: 'Hours spent managing disconnected tools.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-3"
            >
              <div className="h-12 w-12 rounded-full bg-brand-orange/20 flex items-center justify-center">
                <Icon className="h-6 w-6 text-brand-orange" />
              </div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-sm text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* People Deserve Better */}
      <Section>
        <SectionHeading line1="People Deserve Better" highlight="Membership Infrastructure" />
        <p className="text-zinc-400 text-lg max-w-3xl">
          A group is more than a chat thread. It's a shared purpose, identity, and commitment.
          MemberCore exists to give organizations a private, secure, and reliable foundation for
          managing people — no privacy-invading platforms.
        </p>
      </Section>

      {/* The Private Operating System */}
      <Section>
        <SectionHeading line1="The Private Operating System for" highlight="Membership" />
        <p className="text-zinc-400 text-lg max-w-3xl mb-12">
          Replace scattered tools with one secure place to manage chat, events, and visibility — all
          on your terms.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-6">
            {[
              {
                title: 'One app for your organization',
                desc: 'All your messaging, events, and admin controls in one place.',
              },
              {
                title: 'Privacy-first by default',
                desc: 'Your data stays private. No ads, no external algorithms.',
              },
              {
                title: 'Optional public discovery',
                desc: "Choose what's visible to the public and what stays internal.",
              },
            ].map(({ title, desc }) => (
              <div key={title} className="flex gap-4">
                <CheckCircle className="h-6 w-6 text-brand-orange flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-white">{title}</h3>
                  <p className="text-zinc-400 text-sm mt-1">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 overflow-hidden">
            <div className="bg-zinc-800 px-4 py-2 flex items-center gap-2 border-b border-zinc-700">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
              </div>
              <span className="text-xs text-zinc-500 ml-2">membercore.app</span>
            </div>
            <div className="flex">
              <div className="w-16 border-r border-zinc-700 py-4 flex flex-col items-center gap-6">
                <User className="h-5 w-5 text-zinc-400" />
                <MessageCircle className="h-5 w-5 text-zinc-400" />
                <FolderOpen className="h-5 w-5 text-zinc-400" />
                <Settings className="h-5 w-5 text-zinc-400" />
              </div>
              <div className="flex-1 p-6">
                <h3 className="font-semibold text-white mb-6">Upcoming Events</h3>
                <div className="space-y-4">
                  <div className="rounded-lg border border-zinc-700 p-4">
                    <p className="font-medium text-white">Board Meeting</p>
                    <p className="text-sm text-zinc-500">March 15, 2026 • 7:00 PM</p>
                    <Button
                      size="sm"
                      className="mt-2 bg-brand-orange hover:bg-brand-orange/90 text-white border-0 rounded-full"
                    >
                      10 RSVPs
                    </Button>
                  </div>
                  <div className="rounded-lg border border-zinc-700 p-4">
                    <p className="font-medium text-white">New Member Onboarding</p>
                    <p className="text-sm text-zinc-500">March 20, 2026 • 5:00 PM</p>
                    <Button
                      size="sm"
                      className="mt-2 bg-brand-orange hover:bg-brand-orange/90 text-white border-0 rounded-full"
                    >
                      12 RSVPs
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Get Up and Running in Three Steps */}
      <Section>
        <SectionHeading line1="Get Up and Running in" highlight="Three Steps" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          {[
            {
              num: '01',
              title: 'Create your organization',
              desc: 'Set up in under two minutes.',
            },
            {
              num: '02',
              title: 'Invite your members',
              desc: 'Everyone joins free.',
            },
            {
              num: '03',
              title: 'Manage events & visibility',
              desc: 'Control who sees what.',
            },
          ].map(({ num, title, desc }) => (
            <div key={num} className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-full bg-brand-orange flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">{num}</span>
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">{title}</h3>
                <p className="text-zinc-400 mt-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Everything You Need */}
      <Section>
        <SectionHeading line1="Everything You Need —" highlight="Nothing You Don't" />
        <p className="text-zinc-400 text-lg mb-12">Built for privacy, structure, and engagement.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: MessageSquare,
              title: 'Private group chat',
              desc: 'Organized conversations for members only.',
            },
            {
              icon: Calendar,
              title: 'Calendar & events',
              desc: 'Track RSVPs and manage schedules.',
            },
            {
              icon: FileText,
              title: 'Required documents',
              desc: 'Ensure everyone stays informed.',
            },
            {
              icon: MapPin,
              title: 'Map-based discovery',
              desc: 'Help people find your organization.',
            },
            {
              icon: Settings,
              title: 'Admin controls',
              desc: 'Full control over membership.',
            },
            {
              icon: Users,
              title: 'Controlled public directory',
              desc: 'Share what you want publicly.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-3"
            >
              <div className="h-12 w-12 rounded-full bg-brand-orange/20 flex items-center justify-center">
                <Icon className="h-6 w-6 text-brand-orange" />
              </div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-sm text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {[
            { icon: Lock, title: 'Privacy-first', desc: 'No ads, no tracking, no sharing.' },
            { icon: BarChart3, title: 'Built to scale', desc: 'From 10 to 10,000+ members.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-3"
            >
              <div className="h-12 w-12 rounded-full bg-brand-orange/20 flex items-center justify-center">
                <Icon className="h-6 w-6 text-brand-orange" />
              </div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-sm text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Built for Organizations */}
      <Section id="built-for">
        <SectionHeading line1="Built for Organizations That" highlight="Manage People" />
        <p className="text-zinc-400 text-lg mb-12">
          If you manage members, run events, or value privacy — MemberCore was built for you.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ul className="space-y-3">
            {[
              'Motorcycle & riding clubs',
              'Veteran and service groups',
              'Cultural and heritage groups',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-brand-orange flex-shrink-0" />
                <span className="text-zinc-300">{item}</span>
              </li>
            ))}
          </ul>
          <ul className="space-y-3">
            {[
              'Sororities and fraternities',
              'Non-profit and advocacy',
              'Professional associations',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-brand-orange flex-shrink-0" />
                <span className="text-zinc-300">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Pricing */}
      <Section id="pricing">
        <SectionHeading line1="Simple Pricing." highlight="Unlimited Members." />
        <p className="text-zinc-400 text-lg mb-12">
          Start on Pro for 30 days (no card). Then keep Starter free forever or upgrade to Pro.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-8">
            <h3 className="text-xl font-semibold text-white mb-2">Starter</h3>
            <p className="text-3xl font-bold text-white">$0 <span className="text-base font-normal text-zinc-400">/ month</span></p>
            <p className="text-zinc-400 text-sm mt-1 mb-6">Free forever</p>
            <p className="text-zinc-400 text-sm mb-6">
              Great for lightweight scheduling + directory presence.
            </p>
            <ul className="space-y-3 mb-8">
              {['Calendar + events', 'Events directory access', 'Read-only access to group chat + docs'].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-brand-orange flex-shrink-0" />
                  <span className="text-zinc-300 text-sm">{item}</span>
                </li>
              ))}
            </ul>
            <Link to="/signup">
              <Button className="w-full bg-zinc-700 hover:bg-zinc-600 text-white border-0 py-6 rounded-lg">
                Get started
              </Button>
            </Link>
          </div>
          <div className="rounded-xl border-2 border-brand-orange bg-zinc-900/80 p-8">
            <h3 className="text-xl font-semibold text-white mb-2">MemberCore Pro</h3>
            <p className="text-3xl font-bold text-white">$97 <span className="text-base font-normal text-zinc-400">/ month</span></p>
            <p className="text-zinc-400 text-sm mt-1 mb-6">Per organization</p>
            <ul className="space-y-3 mb-8">
              {['Unlimited members', 'Private chat & calendar', 'Directory & map (optional)', 'RSVP tracking', 'Full admin controls'].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-brand-orange flex-shrink-0" />
                  <span className="text-zinc-300 text-sm">{item}</span>
                </li>
              ))}
            </ul>
            <Link to="/signup">
              <Button className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white border-0 py-6 rounded-lg">
                Start 30-day Pro trial (no card)
              </Button>
            </Link>
          </div>
        </div>
      </Section>

      {/* Imagine Membership Without Friction */}
      <Section>
        <SectionHeading line1="Imagine Membership" highlight="Without Friction" />
        <p className="text-zinc-400 text-lg mb-12 max-w-2xl">
          Everyone knows what's happening. Events are better attended. Leaders spend less time
          managing tools.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: 'Everyone knows what\'s happening',
              desc: 'No more "I didn\'t see that" or "I didn\'t know"',
            },
            {
              title: 'Discovery is intentional',
              desc: 'You decide what\'s visible and to whom.',
            },
            {
              title: 'Leaders get time back',
              desc: 'Spend less time managing, more time leading.',
            },
          ].map(({ title, desc }) => (
            <div key={title} className="flex gap-4">
              <div className="h-10 w-10 rounded bg-brand-orange flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="text-zinc-400 text-sm mt-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Final CTA */}
      <Section>
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Bring Your Members Together on{' '}
            <span className="text-brand-orange">MemberCore</span>
          </h2>
          <p className="text-zinc-400 mb-8">
            No setup fees. Cancel anytime before your first 30 days end.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button
                size="lg"
                className="bg-brand-orange hover:bg-brand-orange/90 text-white border-0 px-8 py-6 text-lg rounded-lg flex items-center gap-2 mx-auto sm:mx-0"
              >
                Start free
                <ChevronRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/signin">
              <Button
                size="lg"
                variant="outline"
                className="border-zinc-600 text-white hover:bg-zinc-800 px-8 py-6 text-lg rounded-lg"
              >
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </Section>

      {/* Footer — links to created pages only */}
      <footer className="border-t border-zinc-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">MemberCore © 2026</p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/association-management-software" className="text-sm text-zinc-400 hover:text-white">
              Association Management
            </Link>
            <Link to="/motorcycle-clubs" className="text-sm text-zinc-400 hover:text-white">
              Motorcycle Clubs
            </Link>
            <Link to="/compare/wild-apricot" className="text-sm text-zinc-400 hover:text-white">
              Compare Wild Apricot
            </Link>
            <Link to="/nonprofits" className="text-sm text-zinc-400 hover:text-white">
              Nonprofits
            </Link>
            <Link to="/sports-clubs" className="text-sm text-zinc-400 hover:text-white">
              Sports Clubs
            </Link>
            <Link to="/support" className="text-sm text-zinc-400 hover:text-white">
              Support
            </Link>
            <Link to="/privacy" className="text-sm text-zinc-400 hover:text-white">
              Privacy
            </Link>
            <a href="/terms" className="text-sm text-zinc-400 hover:text-white">
              Terms
            </a>
            <Link to="/support" className="text-sm text-zinc-400 hover:text-white">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
