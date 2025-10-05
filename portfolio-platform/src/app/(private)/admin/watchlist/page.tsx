import { AddToWatchlist } from './_components/AddToWatchlist'
import { WatchlistTable } from './_components/WatchlistTable'
import { getWatchlist } from './actions'

export const metadata = {
  title: 'Watchlist',
  description: 'Track potential investments',
}

export const dynamic = 'force-dynamic'

export default async function WatchlistPage() {
  const watchlist = (await getWatchlist()) || []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Watchlist</h1>
        <p className="text-muted-foreground mt-2">
          Track stocks, ETFs, and crypto you're interested in
        </p>
      </div>

      <AddToWatchlist />

      <WatchlistTable initialWatchlist={watchlist} />
    </div>
  )
}
