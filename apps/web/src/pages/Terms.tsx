import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export default function Terms() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft className="h-5 w-5" />
            Back
          </Link>
          <h1 className="text-lg font-semibold text-white">Terms of Service</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 prose prose-invert prose-zinc max-w-none">
        <p className="text-zinc-400 text-sm mb-8">Last updated: March 2026</p>

        <p className="lead text-zinc-300">
          These Terms of Service govern your use of MemberCore, including our website, web app, and mobile applications.
          By accessing or using MemberCore, you agree to these terms.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. Eligibility and Account</h2>
          <ul className="list-disc pl-6 text-zinc-300 space-y-1">
            <li>You must provide accurate account information and keep it updated.</li>
            <li>You are responsible for activity under your account and for protecting your login credentials.</li>
            <li>You may not use MemberCore for unlawful, fraudulent, or abusive activity.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. Service Use</h2>
          <ul className="list-disc pl-6 text-zinc-300 space-y-1">
            <li>MemberCore provides tools for organizations, including events, messaging, dues, documents, and member management.</li>
            <li>You agree to use the service in compliance with applicable laws and platform policies.</li>
            <li>We may update, improve, or discontinue features at any time.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. Organization and User Content</h2>
          <ul className="list-disc pl-6 text-zinc-300 space-y-1">
            <li>You retain ownership of content you upload, submit, or share.</li>
            <li>You grant MemberCore a limited license to host, process, and display that content to operate the service.</li>
            <li>You are responsible for ensuring content rights and permissions, including event and media content.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. Billing and Payments</h2>
          <ul className="list-disc pl-6 text-zinc-300 space-y-1">
            <li>Subscription billing and one-time payments are processed through Stripe and connected payment providers.</li>
            <li>Organizations are responsible for their subscription status and connected payout account setup when required.</li>
            <li>Fees, plan terms, and billing cycles are shown at checkout and may change with notice.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">5. Acceptable Use Restrictions</h2>
          <ul className="list-disc pl-6 text-zinc-300 space-y-1">
            <li>No attempts to disrupt, reverse engineer, or gain unauthorized access to the service.</li>
            <li>No use of MemberCore to distribute malware, spam, or illegal content.</li>
            <li>We may suspend or terminate access for violations or security risks.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">6. Third-Party Services</h2>
          <p className="text-zinc-300">
            MemberCore integrates with third-party services such as Google, Stripe, Firebase, and Expo. Your use of those
            services is also subject to their own terms and privacy policies.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">7. Disclaimers and Limitation of Liability</h2>
          <p className="text-zinc-300">
            MemberCore is provided &quot;as is&quot; and &quot;as available.&quot; To the maximum extent permitted by law, we disclaim all implied warranties
            and are not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the service.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">8. Termination</h2>
          <p className="text-zinc-300">
            You may stop using MemberCore at any time. We may suspend or terminate accounts for violations of these terms,
            legal requirements, or security reasons.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">9. Changes to Terms</h2>
          <p className="text-zinc-300">
            We may revise these Terms from time to time. Continued use of the service after changes become effective
            constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">10. Contact</h2>
          <ul className="list-disc pl-6 text-zinc-300 mt-2 space-y-1">
            <li>
              <strong>Email:</strong> support@membercore.io
            </li>
            <li>
              <strong>Website:</strong> membercore.io
            </li>
          </ul>
        </section>
      </main>
    </div>
  )
}
