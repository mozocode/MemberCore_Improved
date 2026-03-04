import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CheckCircle, ChevronRight, MapPin, Users } from 'lucide-react'

const CANONICAL_URL = 'https://membercore.io/motorcycle-clubs'

function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section
      id={id}
      className={`py-16 md:py-24 px-6 max-w-4xl mx-auto ${className}`}
    >
      {children}
    </section>
  )
}

export default function MotorcycleClubs() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Motorcycle Clubs | Free Event Directory | MemberCore'
    const link = document.createElement('link')
    link.rel = 'canonical'
    link.href = CANONICAL_URL
    link.setAttribute('data-membercore-canonical', 'motorcycle-clubs')
    document.head.appendChild(link)
    return () => {
      document.title = prevTitle
      const el = document.querySelector('link[data-membercore-canonical="motorcycle-clubs"]')
      if (el) document.head.removeChild(el)
    }
  }, [])

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
        <div className="flex items-center gap-6">
          <Link to="/directory" className="text-zinc-400 hover:text-white transition-colors text-sm">
            Directory
          </Link>
          <Link to="/" className="text-zinc-400 hover:text-white transition-colors text-sm">
            Home
          </Link>
          <Link to="/signin" className="text-zinc-400 hover:text-white transition-colors text-sm">
            Sign In
          </Link>
          <Link to="/signup">
            <Button className="bg-brand-orange hover:bg-brand-orange/90 text-white border-0">
              Add Your Event
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <Section className="text-center pt-16 md:pt-24">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6 leading-tight">
          One Place to Find Every Motorcycle Club Event
        </h1>
        <p className="text-lg md:text-xl text-zinc-400 max-w-3xl mx-auto mb-10 leading-relaxed">
          MemberCore is the free national event directory built for motorcycle clubs. Post your rides and rallies once so riders across the country can actually find them.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup">
            <Button
              size="lg"
              className="bg-brand-orange hover:bg-brand-orange/90 text-white border-0 px-8 py-6 text-lg rounded-lg flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              Add Your Club&apos;s Next Event
              <ChevronRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/signup">
            <Button
              size="lg"
              variant="outline"
              className="border-zinc-600 text-white hover:bg-zinc-800 px-8 py-6 text-lg rounded-lg w-full sm:w-auto justify-center"
            >
              Claim Your Club Profile
            </Button>
          </Link>
        </div>
      </Section>

      {/* The Problem */}
      <Section className="border-t border-zinc-800/50">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          The Problem: Too Many Flyers, Not Enough Awareness
        </h2>
        <p className="text-zinc-400 text-lg mb-6 leading-relaxed">
          You put in the work to throw a solid event:
        </p>
        <ul className="space-y-2 mb-6 text-zinc-300">
          <li>You make the flyer.</li>
          <li>You post it on Facebook.</li>
          <li>You text a few people and hope it spreads.</li>
        </ul>
        <p className="text-zinc-400 mb-4 leading-relaxed">
          But outside your local circle:
        </p>
        <ul className="space-y-3 mb-6">
          {[
            'Riders have no idea what\'s happening.',
            'Other clubs hear about your event after it\'s over.',
            'Big runs and parties get lost in a sea of posts, screenshots, and group chats.',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="text-zinc-500 mt-1">—</span>
              <span className="text-zinc-300">{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-zinc-400 leading-relaxed">
          It shouldn&apos;t be this hard for riders and clubs to find out what&apos;s going on.
        </p>
      </Section>

      {/* The Guide */}
      <Section className="border-t border-zinc-800/50">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          The Guide: Built by a Club for Clubs
        </h2>
        <p className="text-zinc-400 text-lg mb-6 leading-relaxed">
          MemberCore was created by a motorcycle club business manager who was tired of seeing:
        </p>
        <ul className="space-y-2 mb-6 text-zinc-300">
          <li>Great events with small turnouts</li>
          <li>Confusion about what was happening where and when</li>
          <li>No single place to see MC events beyond your own feed</li>
        </ul>
        <p className="text-zinc-400 mb-6 leading-relaxed">
          So we built a <strong className="text-zinc-200">simple, club-controlled directory</strong>:
        </p>
        <ul className="space-y-3 mb-6">
          {[
            'Free for clubs',
            'Easy for riders',
            'One map and list everyone can check before the weekend',
          ].map((item, i) => (
            <li key={i} className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-brand-orange flex-shrink-0" />
              <span className="text-zinc-300">{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-zinc-400 leading-relaxed">
          We&apos;re not a promoter. We&apos;re not an ad network. We ride, too.
        </p>
      </Section>

      {/* The Plan */}
      <Section id="how-it-works" className="border-t border-zinc-800/50">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          The Plan: How Your Club Gets Seen
        </h2>
        <div className="space-y-8 mb-8">
          <div>
            <p className="font-semibold text-white mb-2">1. Claim or create your club profile.</p>
            <p className="text-zinc-400 leading-relaxed">
              Search for your club. If it&apos;s already there, claim it. If not, create it in a couple minutes.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">2. Post your public rides and events.</p>
            <p className="text-zinc-400 leading-relaxed">
              Add dates, times, locations, flyers, and details. Mark them as public so riders can find them.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">3. Share your link and let the directory work.</p>
            <p className="text-zinc-400 leading-relaxed">
              Drop your MemberCore event link on Facebook, Instagram, and flyers. Riders and other clubs can see everything you&apos;ve got coming up in one place.
            </p>
          </div>
        </div>
        <p className="text-zinc-300 font-medium mb-6">It&apos;s free. No contracts. No catch.</p>
        <Link to="/signup">
          <Button className="bg-brand-orange hover:bg-brand-orange/90 text-white border-0 px-6 py-4 rounded-lg inline-flex items-center gap-2">
            Add Your Club&apos;s Next Event
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </Section>

      {/* What You Get */}
      <Section id="what-you-get" className="border-t border-zinc-800/50">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
          What You Get (for Free)
        </h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="font-semibold text-white text-lg mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-orange" />
              For Your Club
            </h3>
            <ul className="text-zinc-400 space-y-2">
              <li>A <strong className="text-zinc-300">free club profile</strong> riders and other clubs can find</li>
              <li>A list of all your <strong className="text-zinc-300">public events</strong> in one link</li>
              <li>A spot on the <strong className="text-zinc-300">national map</strong> of MC events</li>
              <li>Control over your info – you decide what&apos;s public</li>
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="font-semibold text-white text-lg mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-brand-orange" />
              For Riders
            </h3>
            <ul className="text-zinc-400 space-y-2">
              <li>One place to check what&apos;s going on this week and this season</li>
              <li>Events from <strong className="text-zinc-300">clubs they&apos;d never see</strong> in their usual feed</li>
              <li>Easy links to share with friends and chapters</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* What Happens If Nothing Changes */}
      <Section className="border-t border-zinc-800/50">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
          What Happens If Nothing Changes
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="rounded-xl border border-zinc-800 p-6">
            <p className="font-semibold text-zinc-400 mb-4">If you keep doing what you&apos;re doing now:</p>
            <ul className="text-zinc-400 text-sm space-y-2">
              <li>Your flyers keep getting buried in timelines and group chats</li>
              <li>Out-of-town riders never hear about your events</li>
              <li>Big runs stay <strong className="text-zinc-300">local secrets</strong> instead of <strong className="text-zinc-300">regional draws</strong></li>
            </ul>
          </div>
          <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 p-6">
            <p className="font-semibold text-white mb-4">If you put your events on MemberCore:</p>
            <ul className="text-zinc-300 text-sm space-y-2">
              <li>Riders can see you on the map and plan their rides</li>
              <li>Other clubs see your activity and connect</li>
              <li>Your hard work building events actually pays off in turnouts</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* For Bigger Clubs */}
      <Section className="border-t border-zinc-800/50">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          For Bigger, More Organized Clubs
        </h2>
        <p className="text-zinc-400 text-lg leading-relaxed">
          If your club also needs help with:
        </p>
        <ul className="list-disc pl-6 text-zinc-400 my-4 space-y-1">
          <li>Internal communication</li>
          <li>Dues tracking</li>
          <li>Member lists and roles</li>
        </ul>
        <p className="text-zinc-400 leading-relaxed">
          MemberCore can run the <strong className="text-zinc-300">inside of your club</strong> too. But you don&apos;t have to decide that today. Start with the free public event directory and grow from there if it makes sense.
        </p>
      </Section>

      {/* Final CTA */}
      <Section className="border-t border-zinc-800/50 text-center pb-24">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
          You&apos;re already throwing the events. Make them easy to find.
        </h2>
        <p className="text-zinc-400 mb-8">Get your next ride on the map in a few minutes.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup">
            <Button
              size="lg"
              className="bg-brand-orange hover:bg-brand-orange/90 text-white border-0 px-8 py-6 text-lg rounded-lg w-full sm:w-auto inline-flex items-center gap-2 justify-center"
            >
              Add Your Club&apos;s Next Event
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/signup">
            <Button
              size="lg"
              variant="outline"
              className="border-zinc-600 text-white hover:bg-zinc-800 px-8 py-6 text-lg rounded-lg w-full sm:w-auto"
            >
              Claim Your Club Profile
            </Button>
          </Link>
        </div>
      </Section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">MemberCore © 2026</p>
          <div className="flex gap-6">
            <Link to="/directory" className="text-sm text-zinc-400 hover:text-white">Directory</Link>
            <Link to="/" className="text-sm text-zinc-400 hover:text-white">Home</Link>
            <Link to="/privacy" className="text-sm text-zinc-400 hover:text-white">Privacy</Link>
            <Link to="/signin" className="text-sm text-zinc-400 hover:text-white">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
