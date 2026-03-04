import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Mail, MessageSquare, BookOpen, Clock, Send } from 'lucide-react'

const CANONICAL_URL = 'https://membercore.io/support'
const BG = '#0F1117'
const CARD_BORDER = '#262A35'
const PRIMARY = '#FF6A00'
const PRIMARY_LIGHT = '#FF9A33'
const MUTED = '#7A7F8E'
const FG = '#F2F2F2'

const SUBJECT_OPTIONS = [
  'General Question',
  'Account & Billing',
  'Report a Bug',
  'Feature Request',
  'Onboarding Help',
  'Other',
]

const CHANNELS = [
  { icon: Mail, title: 'Email Us', detail: 'support@membercore.io', subtitle: 'Best for account and billing questions' },
  { icon: MessageSquare, title: 'Live Chat', detail: 'Available in-app', subtitle: 'Mon–Fri, 9am–5pm ET' },
  { icon: BookOpen, title: 'Help Center', detail: 'docs.membercore.io', subtitle: 'Guides, FAQs, and tutorials' },
]

export default function Support() {
  const [submitted, setSubmitted] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Support | MemberCore'
    const link = document.createElement('link')
    link.rel = 'canonical'
    link.href = CANONICAL_URL
    link.setAttribute('data-membercore-canonical', 'support')
    document.head.appendChild(link)
    return () => {
      document.title = prevTitle
      const el = document.querySelector('link[data-membercore-canonical="support"]')
      if (el) document.head.removeChild(el)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) return
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: BG }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-10 py-4 border-b sticky top-0 z-50 backdrop-blur" style={{ borderColor: CARD_BORDER, backgroundColor: `${BG}99` }}>
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: PRIMARY }}>M</div>
          <span className="text-xl font-semibold" style={{ color: FG }}>MemberCore</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-sm hover:opacity-90 transition-opacity" style={{ color: MUTED }}>Product</Link>
          <a href="/#pricing" className="text-sm hover:opacity-90 transition-opacity" style={{ color: MUTED }}>Pricing</a>
          <a href="/#built-for" className="text-sm hover:opacity-90 transition-opacity" style={{ color: MUTED }}>Who It&apos;s For</a>
          <Link to="/signin" className="text-sm hover:opacity-90 transition-opacity" style={{ color: MUTED }}>Sign In</Link>
          <Link to="/signup">
            <Button className="text-white border-0 font-semibold px-5 py-2 rounded-lg" style={{ backgroundColor: PRIMARY }}>Get Started</Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        {/* Hero */}
        <header className="text-center pt-8 pb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: FG }}>
            How Can We <span className="bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(to right, ${PRIMARY}, ${PRIMARY_LIGHT})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Help?</span>
          </h1>
          <p className="text-base max-w-xl mx-auto" style={{ color: MUTED }}>
            We&apos;re a small team that takes support seriously. Reach out and we&apos;ll get back to you within one business day.
          </p>
        </header>

        {/* Support channel cards */}
        <div className="grid sm:grid-cols-3 gap-6 mb-12">
          {CHANNELS.map(({ icon: Icon, title, detail, subtitle }) => (
            <div
              key={title}
              className="rounded-xl border p-6 text-center transition-colors hover:border-opacity-80"
              style={{ backgroundColor: 'linear-gradient(180deg, #181B24 0%, #13151C 100%)', borderColor: CARD_BORDER, background: 'linear-gradient(180deg, #181B24 0%, #13151C 100%)' }}
            >
              <div className="w-10 h-10 rounded-lg mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${PRIMARY}26` }}>
                <Icon className="w-5 h-5" style={{ color: PRIMARY }} />
              </div>
              <h3 className="font-semibold text-lg mb-1" style={{ color: FG }}>{title}</h3>
              <p className="text-sm font-medium mb-1" style={{ color: PRIMARY }}>{detail}</p>
              <p className="text-xs" style={{ color: MUTED }}>{subtitle}</p>
            </div>
          ))}
        </div>

        {/* Contact form card */}
        <div className="rounded-xl border p-6 md:p-8 mb-8" style={{ borderColor: CARD_BORDER, background: 'linear-gradient(180deg, #181B24 0%, #13151C 100%)' }}>
          {!submitted ? (
            <>
              <h2 className="text-xl font-bold mb-2" style={{ color: FG }}>Send Us a Message</h2>
              <p className="text-sm mb-6" style={{ color: MUTED }}>We typically respond within one business day.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: FG }}>Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      required
                      className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6A0080]"
                      style={{ backgroundColor: BG, borderColor: CARD_BORDER, color: FG }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: FG }}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6A0080]"
                      style={{ backgroundColor: BG, borderColor: CARD_BORDER, color: FG }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: FG }}>Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6A0080] bg-transparent"
                    style={{ borderColor: CARD_BORDER, color: FG }}
                  >
                    <option value="" style={{ backgroundColor: BG }}>Select a topic</option>
                    {SUBJECT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} style={{ backgroundColor: BG }}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: FG }}>Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="How can we help?"
                    required
                    rows={5}
                    className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6A0080] resize-y"
                    style={{ backgroundColor: BG, borderColor: CARD_BORDER, color: FG }}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-lg py-3.5 font-semibold text-sm text-white border-0"
                  style={{ backgroundColor: PRIMARY, boxShadow: `0 0 40px ${PRIMARY}26` }}
                >
                  Send Message
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${PRIMARY}26` }}>
                <Send className="w-5 h-5" style={{ color: PRIMARY }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: FG }}>Message Sent</h3>
              <p className="text-sm max-w-sm mx-auto" style={{ color: MUTED }}>
                We&apos;ll get back to you shortly. Check your inbox for a confirmation.
              </p>
            </div>
          )}
        </div>

        {/* Response time */}
        <div className="flex items-center justify-center gap-1.5 mb-12" style={{ color: MUTED }}>
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs">Average response time: under 12 hours</span>
        </div>

        {/* Footer */}
        <footer className="border-t py-8 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: CARD_BORDER }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: PRIMARY }}>M</div>
            <p className="text-sm" style={{ color: MUTED }}>MemberCore © 2026</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/terms" className="text-sm hover:opacity-90" style={{ color: MUTED }}>Terms</Link>
            <Link to="/privacy" className="text-sm hover:opacity-90" style={{ color: MUTED }}>Privacy</Link>
            <a href="/#built-for" className="text-sm hover:opacity-90" style={{ color: MUTED }}>Who It&apos;s For</a>
            <Link to="/support" className="text-sm hover:opacity-90" style={{ color: MUTED }}>Contact</Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
