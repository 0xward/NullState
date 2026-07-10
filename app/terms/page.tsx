{/* DRAFT: reviewed against docs/data-safety.md and app data flows. Legal review by 0xward recommended before final submission, especially the Governing Law / Jurisdiction section. */}

import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'

export const metadata = {
  title: 'Terms of Service — NULL_STATE',
  description: 'Terms of Service for NULL_STATE, a Web3 RPG on Celo. Operated by 0xward.',
}

const LAST_UPDATED = 'July 10, 2025'

export default function TermsPage() {
  return (
    <>
      <Navbar />

      <main className="relative z-[2] max-w-3xl mx-auto px-6 pt-32 pb-24">
        {/* Header */}
        <div className="mb-16 border-b border-[rgba(0,255,136,0.15)] pb-10">
          <div className="font-mono text-[10px] tracking-[5px] text-null-green uppercase mb-3">
            // LEGAL
          </div>
          <h1
            className="font-display font-bold text-null-white mb-4"
            style={{ fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1.1 }}
          >
            Terms of Service
          </h1>
          <p className="font-mono text-[11px] tracking-[2px] text-null-muted uppercase mb-2">
            Operated by 0xward
          </p>
          <p className="font-mono text-[10px] tracking-[1px] text-null-muted">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="flex flex-col gap-12 text-[15px] leading-relaxed text-null-muted">

          {/* 1 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              1. Acceptance of Terms
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                By accessing or using NULL_STATE (the &quot;Game&quot; or &quot;Service&quot;), including
                connecting a wallet or interacting with any in-game feature, you agree to be
                bound by these Terms of Service (&quot;Terms&quot;). If you do not agree, do not use
                the Service.
              </p>
              <p>
                The Game is developed and operated by <strong className="text-null-white">0xward</strong> (&quot;Publisher&quot;,
                &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). NULL_STATE is an independent application; it is
                not affiliated with, endorsed by, or operated by MiniPay, Opera, or the Celo
                Foundation. References to those platforms reflect the technology the Game is
                built on or distributed through, not any form of joint operation or sponsorship.
              </p>
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              2. Description of Service
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                NULL_STATE is a real-time dungeon-crawler RPG deployed on the Celo blockchain.
                Players connect a self-custodied wallet and participate in on-chain combat, raid
                events, item collection, and season competitions. Core gameplay actions — such as
                NULL_STRIKEs, raid attacks, vault submissions, and claiming burn rewards — are
                executed as signed transactions on Celo mainnet.
              </p>
              <p>
                Off-chain game state (item inventory, current progress, season stats) is stored
                in a Firebase-backed database operated by 0xward and governed by our
                Privacy Policy.
              </p>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              3. Eligibility
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                You must be of legal age in your jurisdiction to enter into binding contracts and
                to use blockchain-based applications. By using the Service, you represent that
                you meet this requirement and that you are not prohibited from accessing or using
                the Service under applicable law. The Service is not available in jurisdictions
                where blockchain applications, digital assets, or related activities are
                prohibited.
              </p>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              4. User Responsibilities
            </h2>
            <div className="pl-4 flex flex-col gap-4">
              <div>
                <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                  Wallet &amp; Seed Phrase Security
                </h3>
                <p>
                  You are solely responsible for the security of your wallet, private keys, and
                  seed phrase. <strong className="text-null-white">0xward never has access to
                  your private keys or seed phrase and will never ask for them.</strong> Loss of
                  your seed phrase may result in permanent loss of access to your on-chain
                  assets. Write it down and store it securely offline.
                </p>
              </div>
              <div>
                <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                  Transaction Signing
                </h3>
                <p>
                  Every in-game action that affects on-chain state requires you to explicitly
                  sign a transaction using your wallet. By signing, you authorise the
                  corresponding blockchain transaction. Review all transaction details in your
                  wallet before confirming. <strong className="text-null-white">On-chain
                  transactions are irreversible once confirmed.</strong>
                </p>
              </div>
              <div>
                <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                  Accurate Information
                </h3>
                <p>
                  You agree not to misrepresent your identity or attempt to impersonate another
                  player or entity. Your wallet address serves as your in-game identity.
                </p>
              </div>
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              5. No Warranty / As-Is / Risk Disclosure
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF
                ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>
              <p>
                <strong className="text-null-white">Blockchain &amp; Smart Contract Risk:</strong>{' '}
                Smart contracts are immutable once deployed and may contain bugs. Blockchain
                transactions carry inherent risk, including gas fee volatility, network
                congestion, protocol changes, and the irreversible nature of on-chain actions.
                0xward does not guarantee the correctness of smart contract logic or the
                continued availability of any blockchain network.
              </p>
              <p>
                <strong className="text-null-white">Digital Asset Volatility:</strong>{' '}
                CELO and USDm values can fluctuate significantly. In-game rewards have no
                guaranteed monetary value. You participate at your own financial risk.
              </p>
              <p>
                <strong className="text-null-white">No Audit:</strong>{' '}
                NULL_STATE smart contracts have not undergone a formal third-party security
                audit at the time of this writing. Play with amounts you are comfortable
                risking.
              </p>
              <p>
                <strong className="text-null-white">Service Availability:</strong>{' '}
                We do not guarantee uninterrupted access. The Service may be suspended or
                terminated at any time, with or without notice.
              </p>
            </div>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              6. Prohibited Conduct
            </h2>
            <div className="pl-4">
              <p className="mb-3">You agree not to:</p>
              <ul className="flex flex-col gap-2 font-mono text-sm">
                {[
                  'Exploit bugs, glitches, or vulnerabilities in the Game or smart contracts.',
                  'Use bots, scripts, or automated tools to interact with the Service.',
                  'Attempt to reverse-engineer, decompile, or tamper with smart contract logic in ways not permitted by the open-source licence.',
                  'Harass, threaten, or abuse other users.',
                  'Use the Service for money laundering, fraud, or any illegal purpose.',
                  'Impersonate 0xward, MiniPay, Celo, or any other entity.',
                  'Circumvent or attempt to circumvent any security or access-control mechanism.',
                ].map((item) => (
                  <li key={item} className="pl-4 relative before:content-[&apos;—&apos;] before:absolute before:left-0 before:text-null-green">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              7. Intellectual Property
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                The NULL_STATE frontend and smart contracts are published under the MIT licence
                and available on GitHub. This licence grants you rights to view and use the
                source code subject to its terms. It does not grant rights to the NULL_STATE
                name, logo, or brand assets, which remain the property of 0xward.
              </p>
              <p>
                On-chain data (your wallet address, transaction history, leaderboard rankings,
                Pass NFTs) is public by nature of the Celo blockchain and is not the exclusive
                property of 0xward or any other party.
              </p>
            </div>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              8. Limitation of Liability
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, 0XWARD AND ITS CONTRIBUTORS
                SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
                PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, DIGITAL ASSETS, OR
                GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE
                THE SERVICE, REGARDLESS OF THE THEORY OF LIABILITY AND EVEN IF 0XWARD HAS BEEN
                ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
              <p>
                IN JURISDICTIONS THAT DO NOT ALLOW THE EXCLUSION OR LIMITATION OF LIABILITY FOR
                CONSEQUENTIAL OR INCIDENTAL DAMAGES, THE ABOVE LIMITATIONS SHALL APPLY TO THE
                FULLEST EXTENT PERMITTED BY LAW.
              </p>
            </div>
          </section>

          {/* 9 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              9. Modifications to Terms
            </h2>
            <div className="pl-4">
              <p>
                0xward reserves the right to modify these Terms at any time. Changes take effect
                when posted to this page with an updated &quot;Last updated&quot; date. Continued use of
                the Service after changes are posted constitutes acceptance of the revised Terms.
                We recommend checking this page periodically.
              </p>
            </div>
          </section>

          {/* 10 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              10. Termination / Suspension of Access
            </h2>
            <div className="pl-4">
              <p>
                0xward may suspend or terminate your access to the Service at any time, without
                notice, for conduct that violates these Terms or is otherwise harmful to other
                users or the integrity of the Game. Because the core game logic lives on a public
                blockchain, termination of access to this frontend does not affect your on-chain
                assets or history.
              </p>
            </div>
          </section>

          {/* 11 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              11. Governing Law
            </h2>
            <div className="pl-4">
              <p className="text-null-amber font-mono text-sm border border-[rgba(255,170,0,0.3)] px-4 py-3">
                [Governing Law / Jurisdiction — TBD by 0xward legal. This section must be
                completed with the appropriate jurisdiction before final submission to any
                app store or platform, including MiniPay.]
              </p>
            </div>
          </section>

          {/* 12 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              12. Contact
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                For questions about these Terms or for general support, reach the 0xward team via
                our official support channel:
              </p>
              <p>
                <a
                  href="https://t.me/nullstate_id"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-null-green hover:text-null-acid transition-colors font-mono text-sm"
                >
                  https://t.me/nullstate_id
                </a>
              </p>
            </div>
          </section>

        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-[rgba(0,255,136,0.15)] flex flex-wrap gap-6 justify-center font-mono text-[11px] tracking-[2px] uppercase">
          <a href="/privacy" className="text-null-muted hover:text-null-green transition-colors no-underline">
            Privacy Policy
          </a>
          <a href="/docs" className="text-null-muted hover:text-null-green transition-colors no-underline">
            Docs
          </a>
          <a href="/" className="text-null-muted hover:text-null-green transition-colors no-underline">
            Home
          </a>
        </div>
      </main>

      <Footer />
    </>
  )
}
