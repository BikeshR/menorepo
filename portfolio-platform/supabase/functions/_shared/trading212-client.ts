/**
 * Trading212 API Client for Edge Functions
 */

export interface Trading212Position {
  ticker: string
  quantity: number
  averagePrice: number
  currentPrice: number
  ppl: number
  pplPercentage: number
  value: number
}

export async function fetchTrading212Positions(): Promise<Trading212Position[]> {
  const apiKey = Deno.env.get('TRADING212_API_KEY')
  if (!apiKey) {
    throw new Error('Trading212 API key not configured')
  }

  const response = await fetch('https://live.trading212.com/api/v0/equity/portfolio', {
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Trading212 API error: ${response.status}`)
  }

  return await response.json()
}

export async function fetchTrading212Orders(limit = 50) {
  const apiKey = Deno.env.get('TRADING212_API_KEY')
  if (!apiKey) {
    throw new Error('Trading212 API key not configured')
  }

  const response = await fetch(
    `https://live.trading212.com/api/v0/equity/history/orders?limit=${limit}`,
    {
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Trading212 API error: ${response.status}`)
  }

  return await response.json()
}
