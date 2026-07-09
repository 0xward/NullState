import Navbar from '@/components/ui/Navbar'
import LeaderboardPageClient from '@/components/game/LeaderboardPageClient'

export const metadata = {
  title: 'NullState Leaderboard',
  description: 'Season rankings and top players in NullState.',
}

export default function LeaderboardPage() {
  return (
    <>
      <Navbar />
      <main className="relative z-[2] mx-auto max-w-5xl px-6 pb-16 pt-28">
        <LeaderboardPageClient />
      </main>
    </>
  )
}
