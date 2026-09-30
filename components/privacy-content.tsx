// Shared by the /privacy page and the privacy modal.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-white/75 font-medium text-sm">{title}</h3>
      <div className="text-white/35 text-xs leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

export function PrivacyContent({ headingLevel: Heading = "h2" }: { headingLevel?: "h1" | "h2" }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Heading className="text-2xl font-semibold text-white tracking-tight mb-1">Privacy Policy</Heading>
        <p className="text-white/25 text-xs">axl by ARX Studios · Last updated: September 2026</p>
      </div>
      <div className="h-px bg-white/[0.06]" />
      <Section title="1. Information We Collect">
        <p>axl uses your ARX Studios account to sign you in, with Google or an email link. We store your account ID and email address so your short links belong to you.</p>
        <p>For each short link you create, we store the destination URL, the short code, when it was created, its expiry date if you set one, and how many times it has been opened.</p>
        <p>When someone opens a short link, we only increase that link&apos;s click count. We don&apos;t store anything about the visitor.</p>
      </Section>
      <Section title="2. How We Use Your Information">
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>Show you your links and their click counts</li>
          <li>Redirect visitors to your destination URLs</li>
          <li>Prevent abuse, for example by limiting how fast links can be created</li>
          <li>Respond to support inquiries</li>
        </ul>
        <p>We do not sell, rent, or share your personal data with third parties for marketing purposes.</p>
      </Section>
      <Section title="3. Data Storage & Security">
        <p>Your account is managed by Supabase. Links are stored in a Supabase Postgres database, and a short-lived cache of links and counters is kept on Render. The app runs on Vercel. All traffic uses HTTPS.</p>
      </Section>
      <Section title="4. Cookies">
        <p>We use session cookies to keep you signed in. We do not use advertising cookies or tracking pixels.</p>
      </Section>
      <Section title="5. Your Rights">
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>Delete any of your links at any time from your dashboard</li>
          <li>Ask us for a copy of the data we hold about you</li>
          <li>Ask us to delete your account and all of your links</li>
        </ul>
        <p>Deleted links stop working immediately. Their short codes are kept reserved so nobody else can reuse them.</p>
      </Section>
      <Section title="6. Changes to This Policy">
        <p>We may update this policy from time to time. If we make significant changes, we will notify users by email before they take effect.</p>
      </Section>
      <Section title="7. Contact">
        <p>For any questions, contact us at <span className="text-white/50">privacy@arxstudios.com</span>.</p>
      </Section>
    </div>
  )
}
