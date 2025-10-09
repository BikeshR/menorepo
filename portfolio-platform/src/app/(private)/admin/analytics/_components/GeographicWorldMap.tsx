'use client'

import { useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
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

// Map country names to ISO 3166-1 alpha-3 codes for react-simple-maps
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  'United States': 'USA',
  'United Kingdom': 'GBR',
  Canada: 'CAN',
  Germany: 'DEU',
  France: 'FRA',
  Italy: 'ITA',
  Spain: 'ESP',
  Netherlands: 'NLD',
  Belgium: 'BEL',
  Switzerland: 'CHE',
  Sweden: 'SWE',
  Norway: 'NOR',
  Denmark: 'DNK',
  Finland: 'FIN',
  Ireland: 'IRL',
  Austria: 'AUT',
  Portugal: 'PRT',
  Greece: 'GRC',
  Poland: 'POL',
  Japan: 'JPN',
  China: 'CHN',
  'South Korea': 'KOR',
  India: 'IND',
  Australia: 'AUS',
  'New Zealand': 'NZL',
  Singapore: 'SGP',
  'Hong Kong': 'HKG',
  Taiwan: 'TWN',
  Brazil: 'BRA',
  Mexico: 'MEX',
  Argentina: 'ARG',
  Chile: 'CHL',
  Russia: 'RUS',
  'South Africa': 'ZAF',
  Israel: 'ISR',
  'Saudi Arabia': 'SAU',
  'United Arab Emirates': 'ARE',
  Turkey: 'TUR',
}

// TopoJSON URL for world map
const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

export function GeographicWorldMap({ data }: GeographicWorldMapProps) {
  const [tooltipContent, setTooltipContent] = useState('')

  // Create a map of country ISO codes to their portfolio data
  const countryDataMap = new Map<string, { value: number; percentage: number; holdings: number }>()

  for (const region of data) {
    for (const country of region.countries) {
      const isoCode = COUNTRY_NAME_TO_ISO[country]
      if (isoCode) {
        // If multiple regions have the same country, aggregate
        const existing = countryDataMap.get(isoCode) || { value: 0, percentage: 0, holdings: 0 }
        countryDataMap.set(isoCode, {
          value: existing.value + region.value / region.countries.length, // Split value across countries in region
          percentage: existing.percentage + region.percentage / region.countries.length,
          holdings: existing.holdings + Math.ceil(region.holdings / region.countries.length),
        })
      }
    }
  }

  // Get max percentage for color scaling
  const maxPercentage = Math.max(...Array.from(countryDataMap.values()).map((d) => d.percentage), 1)

  // Get color intensity based on percentage
  const getCountryColor = (geo: any) => {
    const countryData = countryDataMap.get(geo.id)
    if (!countryData) return '#e2e8f0' // Light gray for countries without data

    const intensity = countryData.percentage / maxPercentage
    // Blue color scale from light to dark
    if (intensity > 0.7) return '#1e40af' // Dark blue
    if (intensity > 0.5) return '#3b82f6' // Medium blue
    if (intensity > 0.3) return '#60a5fa' // Light blue
    if (intensity > 0.1) return '#93c5fd' // Very light blue
    return '#dbeafe' // Pale blue
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Geographic Distribution Map</CardTitle>
        <CardDescription>Portfolio allocation across countries</CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="relative w-full" style={{ aspectRatio: '800/350' }}>
          <ComposableMap
            width={800}
            height={350}
            projectionConfig={{
              scale: 147,
              center: [0, 10],
            }}
            className="w-full h-full"
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryData = countryDataMap.get(geo.id)
                  const hasHoldings = countryData !== undefined

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getCountryColor(geo)}
                      stroke="#ffffff"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: hasHoldings
                          ? {
                              fill: '#f59e0b',
                              outline: 'none',
                              cursor: 'pointer',
                            }
                          : {
                              outline: 'none',
                            },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={() => {
                        if (countryData) {
                          setTooltipContent(
                            `${geo.properties.name}: £${countryData.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (${countryData.percentage.toFixed(1)}%)`
                          )
                        }
                      }}
                      onMouseLeave={() => {
                        setTooltipContent('')
                      }}
                    />
                  )
                })
              }
            </Geographies>
          </ComposableMap>

          {/* Tooltip */}
          {tooltipContent && (
            <div className="absolute top-4 left-4 bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-md text-sm border">
              {tooltipContent}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#dbeafe' }} />
            <span className="text-xs text-muted-foreground">Low</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#60a5fa' }} />
            <span className="text-xs text-muted-foreground">Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#1e40af' }} />
            <span className="text-xs text-muted-foreground">High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#e2e8f0' }} />
            <span className="text-xs text-muted-foreground">No holdings</span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-md bg-muted/30">
            <div className="text-sm text-muted-foreground">Countries</div>
            <div className="text-2xl font-bold">{countryDataMap.size}</div>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/30">
            <div className="text-sm text-muted-foreground">Regions</div>
            <div className="text-2xl font-bold">{data.length}</div>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/30">
            <div className="text-sm text-muted-foreground">Total Holdings</div>
            <div className="text-2xl font-bold">
              {data.reduce((sum, region) => sum + region.holdings, 0)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
