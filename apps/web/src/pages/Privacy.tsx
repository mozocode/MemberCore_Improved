import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </Link>
          <h1 className="text-lg font-semibold text-white">Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 prose prose-invert prose-zinc max-w-none">
        <p className="text-zinc-400 text-sm mb-8">Last updated: February 2026</p>

        <p className="lead text-zinc-300">
          MemberCore (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the MemberCore mobile application and related web services. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our app and services.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. Information We Collect</h2>
          <h3 className="text-base font-medium text-zinc-200 mt-6 mb-2">Account and profile</h3>
          <ul className="list-disc pl-6 text-zinc-300 space-y-1">
            <li><strong>Name and email address</strong> when you create an account</li>
            <li><strong>Password</strong> (stored in hashed form; we never see your plain-text password)</li>
            <li><strong>Profile information</strong> you choose to add, such as profile photo (avatar) and phone number</li>
          </ul>
          <h3 className="text-base font-medium text-zinc-200 mt-6 mb-2">Organization and membership</h3>
          <ul className="list-disc pl-6 text-zinc-300 space-y-1">
            <li>Organizations you join or create</li>
            <li>Your role and membership status within each organization</li>
            <li>Invite codes you use to join organizations</li>
          </ul>
          <h3 className="text-base font-medium text-zinc-200 mt-6 mb-2">Activity and content</h3>
          <ul className="list-disc pl-6 text-zinc-300 space-y-1">
            <li><strong>Events:</strong> RSVPs, ticket registrations, and event-related activity</li>
            <li><strong>Messages and chat:</strong> Direct messages and channel conversations within organizations</li>
            <li><strong>Documents:</strong> Files and documents you upload or access within organizations</li>
            <li><strong>Directory:</strong> Information visible in organization directories according to each organization&apos;s settings</li>
            <li><strong>Polls:</strong> Your responses to polls within organizations</li>
            <li><strong>Dues and payments:</strong> If you pay dues or make payments through the app, payment-related data is processed by our payment provider (see Section 3)</li>
          </ul>
          <h3 className="text-base font-medium text-zinc-200 mt-6 mb-2">Device and technical data</h3>
          <ul className="list-disc pl-6 text-zinc-300 space-y-1">
            <li><strong>Push notification token</strong> so we can send you notifications (e.g. new messages, event reminders) if you enable them</li>
            <li><strong>Device type and app version</strong> to support and improve the app</li>
            <li><strong>Log data</strong> (e.g. IP address, request timestamps) for security and operation of our servers</li>
          </ul>
          <p className="text-zinc-300 mt-4">We do not sell your personal information.</p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. How We Use Your Information</h2>
          <p className="text-zinc-300 mb-4">We use the information we collect to:</p>
          <ul className="list-disc pl-6 text-zinc-300 space-y-1">
            <li>Create and manage your account and authenticate you</li>
            <li>Provide organization features: chat, events, directory, documents, polls, dues, and messages</li>
            <li>Send you push notifications you have agreed to (e.g. messages, event updates)</li>
            <li>Process payments when you pay dues or make other payments through the app</li>
            <li>Operate, secure, and improve our services and fix issues</li>
            <li>Comply with legal obligations and enforce our terms</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. Sharing and Third-Party Services</h2>
          <ul className="list-disc pl-6 text-zinc-300 space-y-2">
            <li><strong>Organizations:</strong> Other members and admins of organizations you join can see your name, profile, and activity within that organization according to that organization&apos;s settings.</li>
            <li><strong>Service providers:</strong> We use trusted third parties to run our services: hosting and database (e.g. Firebase / Google Cloud), payment processing (Stripe — see <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Stripe&apos;s privacy policy</a>), and push notification delivery (Expo, Apple, Google).</li>
            <li>We do not sell your data. We may disclose information if required by law (e.g. subpoena, court order) or to protect our rights, safety, or the safety of others.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. Data Retention and Security</h2>
          <p className="text-zinc-300">
            We retain your account and content for as long as your account is active or as needed to provide the service. You may request deletion of your account (see Section 5). We use industry-standard measures (e.g. encryption in transit, secure storage, access controls) to protect your data. No method of transmission or storage is 100% secure; we cannot guarantee absolute security.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">5. Your Rights and Choices</h2>
          <ul className="list-disc pl-6 text-zinc-300 space-y-1">
            <li><strong>Access and correction:</strong> You can view and update your profile and account settings in the app.</li>
            <li><strong>Delete account:</strong> You may request deletion of your account and associated data by contacting us (see Section 8).</li>
            <li><strong>Push notifications:</strong> You can disable push notifications in your device settings or in the app.</li>
            <li><strong>Location:</strong> We do not collect your precise location unless you voluntarily add it; you control what you share.</li>
          </ul>
          <p className="text-zinc-300 mt-4">Depending on where you live, you may have additional rights (e.g. under GDPR or CCPA). Contact us to exercise those rights.</p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">6. Children&apos;s Privacy</h2>
          <p className="text-zinc-300">
            Our services are not directed to children under 13 (or the applicable age in your country). We do not knowingly collect personal information from children. If you believe we have collected such information, please contact us and we will delete it.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">7. International Data</h2>
          <p className="text-zinc-300">
            Our systems may be hosted in the United States or other countries. If you use the app from outside the U.S., your information may be transferred to and processed in those locations. By using MemberCore, you consent to such transfer and processing.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">8. Changes to This Policy</h2>
          <p className="text-zinc-300">
            We may update this Privacy Policy from time to time. We will post the updated policy on this page and, for material changes, we may notify you in the app or by email. The &quot;Last updated&quot; date at the top reflects the latest version. Continued use of the app after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mt-8 mb-4">9. Contact Us</h2>
          <p className="text-zinc-300">
            If you have questions about this Privacy Policy or your personal data, or to request access, correction, or deletion of your data, contact us:
          </p>
          <ul className="list-disc pl-6 text-zinc-300 mt-2 space-y-1">
            <li><strong>Email:</strong> privacy@membercore.io (or your support email)</li>
            <li><strong>App / website:</strong> MemberCore (membercore.io or your published URL)</li>
          </ul>
        </section>

        <p className="text-zinc-500 text-sm mt-12 border-t border-zinc-800 pt-8">
          This privacy policy applies to the MemberCore application and related web services.
        </p>
      </main>
    </div>
  )
}
