'use client'

// Removed react-simple-maps dependency
// import { useState } from 'react'
// import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface GeographicWorldMapProps {
  data: Array<{
    region: string
    value: number
    percentage: number
    holdings: number
    countries: string[]
  }>
}

export function GeographicWorldMap({ data }: GeographicWorldMapProps) {
  // Geographic map temporarily disabled - react-simple-maps dependency removed
  return (
    <Card>
      <CardHeader>
        <CardTitle>Geographic Distribution</CardTitle>
        <CardDescription>Portfolio allocation across regions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((region) => (
            <div key={region.region} className="border-b pb-4 last:border-0">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">{region.region}</span>
                <span className="text-sm text-muted-foreground">
                  {region.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>£{region.value.toLocaleString()}</span>
                <span>{region.holdings} holdings</span>
              </div>
              {region.countries.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {region.countries.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
