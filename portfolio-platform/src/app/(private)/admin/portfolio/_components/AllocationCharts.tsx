'use client'

import { DonutChart } from './DonutChart'

type Position = {
  ticker: string
  name: string
  asset_type: string
  market_value: number | null
  sector: string | null
  region: string | null
}

type CryptoPosition = {
  symbol: string
  market_value: number | null
}

interface AllocationChartsProps {
  positions: Position[]
  cryptoPositions: CryptoPosition[]
}

// Color palettes for different chart types
const ASSET_TYPE_COLORS: Record<string, string> = {
  stock: 'hsl(217, 91%, 60%)', // Blue
  etf: 'hsl(142, 71%, 45%)', // Green
  crypto: 'hsl(48, 96%, 53%)', // Yellow/Gold
}

const SECTOR_COLORS = [
  'hsl(217, 91%, 60%)', // Blue
  'hsl(142, 71%, 45%)', // Green
  'hsl(48, 96%, 53%)', // Yellow
  'hsl(262, 83%, 58%)', // Purple
  'hsl(346, 77%, 50%)', // Red
  'hsl(173, 58%, 39%)', // Teal
  'hsl(24, 74%, 58%)', // Orange
  'hsl(280, 70%, 60%)', // Violet
]

const REGION_COLORS = [
  'hsl(217, 91%, 60%)', // Blue
  'hsl(142, 71%, 45%)', // Green
  'hsl(48, 96%, 53%)', // Yellow
  'hsl(346, 77%, 50%)', // Red
  'hsl(262, 83%, 58%)', // Purple
]

export function AllocationCharts({ positions, cryptoPositions }: AllocationChartsProps) {
  // Calculate asset type allocation
  const assetTypeData = calculateAssetTypeAllocation(positions, cryptoPositions)

  // Calculate sector allocation (stocks only)
  const sectorData = calculateSectorAllocation(positions)

  // Calculate region allocation
  const regionData = calculateRegionAllocation(positions)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <DonutChart data={assetTypeData} title="Asset Type Allocation" />
      <DonutChart data={sectorData} title="Sector Allocation (Stocks)" />
      <DonutChart data={regionData} title="Geographic Allocation" />
    </div>
  )
}

function calculateAssetTypeAllocation(
  positions: Position[],
  cryptoPositions: CryptoPosition[]
): Array<{ name: string; value: number; color: string }> {
  const totals: Record<string, number> = {
    stock: 0,
    etf: 0,
    crypto: 0,
  }

  // Sum stock and ETF values
  for (const position of positions) {
    const value = position.market_value || 0
    const assetType = position.asset_type.toLowerCase()
    if (totals[assetType] !== undefined) {
      totals[assetType] += value
    }
  }

  // Sum crypto values
  for (const crypto of cryptoPositions) {
    totals.crypto += crypto.market_value || 0
  }

  return [
    { name: 'Stocks', value: totals.stock, color: ASSET_TYPE_COLORS.stock },
    { name: 'ETFs', value: totals.etf, color: ASSET_TYPE_COLORS.etf },
    { name: 'Crypto', value: totals.crypto, color: ASSET_TYPE_COLORS.crypto },
  ]
}

function calculateSectorAllocation(
  positions: Position[]
): Array<{ name: string; value: number; color: string }> {
  const sectorTotals: Record<string, number> = {}

  // Only include stocks (not ETFs) for sector breakdown
  for (const position of positions) {
    if (position.asset_type.toLowerCase() === 'stock' && position.sector) {
      const sector = position.sector
      const value = position.market_value || 0
      sectorTotals[sector] = (sectorTotals[sector] || 0) + value
    }
  }

  // Convert to array and sort by value descending
  return Object.entries(sectorTotals)
    .map(([name, value], index) => ({
      name,
      value,
      color: SECTOR_COLORS[index % SECTOR_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value)
}

function calculateRegionAllocation(
  positions: Position[]
): Array<{ name: string; value: number; color: string }> {
  const regionTotals: Record<string, number> = {}

  for (const position of positions) {
    if (position.region) {
      const region = position.region
      const value = position.market_value || 0
      regionTotals[region] = (regionTotals[region] || 0) + value
    }
  }

  // Convert to array and sort by value descending
  return Object.entries(regionTotals)
    .map(([name, value], index) => ({
      name,
      value,
      color: REGION_COLORS[index % REGION_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value)
}
