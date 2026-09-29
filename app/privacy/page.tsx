import { ShaderAnimation } from "@/components/ui/shader-animation"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-white/80 font-medium text-sm">{title}</h2>
      <div className="text-white/35 text-xs leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

export default function PrivacyPage() {
  return (
    <>
      <ShaderAnimation />
      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1 px-6 py-16">
          <div className="max-w-2xl mx-auto">
            <div className="bg-black/30 backdrop-blur-md border border-white/[0.08] rounded-2xl p-8 md:p-10 flex flex-col gap-8">

              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight text-white">Privacy Policy</h1>
                <p className="text-white/25 text-xs">Last updated: April 2026</p>
              </div>

              <div className="h-px bg-white/[0.06]" />

              <Section title="1. Information We Collect">
                <p>
                  When you sign in with Google, we receive your name, email address, and profile
                  picture from your Google account. We use this information solely to identify
                  you within ARX Studios and to communicate updates about our launch.
                </p>
                <p>
                  We may also collect standard usage data such as pages visited, time spent, and
                  device type to improve the product experience.
                </p>
              </Section>

              <Section title="2. How We Use Your Information">
                <p>We use the information we collect to:</p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>Notify you when ARX Studios launches</li>
                  <li>Provide access to early features and beta programs</li>
                  <li>Improve and personalise your experience</li>
                  <li>Respond to support inquiries</li>
                </ul>
                <p>We do not sell, rent, or share your personal data with third parties for marketing purposes.</p>
              </Section>

              <Section title="3. Data Storage & Security">
                <p>
                  Your data is stored securely using Supabase, which is hosted on infrastructure
                  compliant with industry-standard security practices. We use HTTPS for all data
                  in transit and enforce access controls to limit who can view your information.
                </p>
              </Section>

              <Section title="4. Cookies & Tracking">
                <p>
                  We use session cookies to keep you signed in. We do not use third-party
                  advertising cookies or tracking pixels. Basic analytics may be used to
                  understand how visitors interact with the site.
                </p>
              </Section>

              <Section title="5. Your Rights">
                <p>You have the right to:</p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>Access the personal data we hold about you</li>
                  <li>Request correction or deletion of your data</li>
                  <li>Withdraw consent at any time by deleting your account</li>
                </ul>
                <p>
                  To exercise any of these rights, contact us at the address below.
                </p>
              </Section>

              <Section title="6. Changes to This Policy">
                <p>
                  We may update this policy from time to time. If we make significant changes,
                  we will notify signed-up users by email before the changes take effect.
                </p>
              </Section>

              <Section title="7. Contact">
                <p>
                  For any questions about this privacy policy or your data, please contact us at{" "}
                  <span className="text-white/50">privacy@arxstudios.com</span>.
                </p>
              </Section>

            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}
