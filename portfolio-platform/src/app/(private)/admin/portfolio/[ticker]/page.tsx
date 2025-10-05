import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPositionDetails } from '../actions'
import { FundamentalMetrics } from './_components/FundamentalMetrics'
import { PositionChart } from './_components/PositionChart'
import { PositionOverview } from './_components/PositionOverview'
import { PositionTransactions } from './_components/PositionTransactions'

export const dynamic = 'force-dynamic'

interface PositionPageProps {
  params: Promise<{
    ticker: string
  }>
}

export default async function PositionPage({ params }: PositionPageProps) {
  const { ticker } = await params
  const decodedTicker = decodeURIComponent(ticker)

  const positionData = await getPositionDetails(decodedTicker)

  if (!positionData) {
    notFound()
  }

  const isStock = positionData.type === 'stock'
  const position = positionData.position

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/admin/portfolio"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Portfolio
      </Link>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">{position.name || decodedTicker}</h1>
        <p className="text-muted-foreground mt-1">
          {decodedTicker} · {isStock ? (position as any).asset_type?.toUpperCase() : 'Crypto'}
        </p>
      </div>

      {/* Position Overview */}
      <PositionOverview position={position} type={positionData.type} />

      {/* Fundamental Metrics (stocks only) */}
      {isStock && positionData.fundamentals && (
        <FundamentalMetrics fundamentals={positionData.fundamentals} />
      )}

      {/* Position History Chart */}
      {positionData.history.length > 0 && (
        <PositionChart
          history={positionData.history}
          type={positionData.type}
          ticker={decodedTicker}
        />
      )}

      {/* Transaction History */}
      {positionData.transactions.length > 0 && (
        <PositionTransactions transactions={positionData.transactions} />
      )}
    </div>
  )
}
