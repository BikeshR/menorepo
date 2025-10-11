import { ArrowUpRight, BarChart3, Image, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPortfolioSummary } from './portfolio/actions'

export const metadata = {
  title: 'Dashboard',
  description: 'Investment portfolio dashboard',
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const portfolioData = await getPortfolioSummary()

  // Calculate portfolio stats
  const totalValue = portfolioData?.latestSnapshot?.total_value || 0
  const totalGainLoss = portfolioData?.latestSnapshot?.total_gain_loss || 0
  const totalGainLossPercent = portfolioData?.latestSnapshot?.total_return_pct || 0
  const totalCostBasis = portfolioData?.latestSnapshot?.total_cost_basis || 0
  const positionsCount =
    (portfolioData?.positions?.length || 0) + (portfolioData?.cryptoPositions?.length || 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back! Here's an overview of your investment portfolio.
        </p>
      </div>

      {/* Portfolio Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              £{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{positionsCount} holdings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gain/Loss</CardTitle>
            <TrendingUp
              className={`h-4 w-4 ${totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {totalGainLoss >= 0 ? '+' : ''}£
              {totalGainLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p
              className={`text-xs mt-1 ${totalGainLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {totalGainLossPercent >= 0 ? '+' : ''}
              {totalGainLossPercent.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Basis</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              £{totalCostBasis.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total invested</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Holdings</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{positionsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {portfolioData?.positions?.length || 0} stocks,{' '}
              {portfolioData?.cryptoPositions?.length || 0} crypto
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Details</CardTitle>
            <CardDescription>View all holdings and performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Stocks & ETFs</span>
                <span className="font-medium">{portfolioData?.positions?.length || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Crypto</span>
                <span className="font-medium">{portfolioData?.cryptoPositions?.length || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Positions</span>
                <span className="font-medium">{positionsCount}</span>
              </div>
              <Link href="/admin/portfolio">
                <Button variant="outline" className="w-full mt-2">
                  View Portfolio
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Portfolio Analytics</CardTitle>
            <CardDescription>Advanced analysis and risk metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Explore sector allocation, geographic diversification, risk metrics, correlation
                analysis, and tax tracking.
              </p>
              <Link href="/admin/analytics">
                <Button className="w-full">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Analytics
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>COSMO Objekts</CardTitle>
            <CardDescription>View your TripleS COSMO collection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Explore your objekt collection on Abstract blockchain. View stats, filter by member
                or season, and check your COMO voting power.
              </p>
              <Link href="/admin/cosmo">
                <Button variant="outline" className="w-full">
                  <Image className="mr-2 h-4 w-4" />
                  View Objekts
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
