/**
 * AI Portfolio Insights Edge Function
 *
 * This function generates AI-powered portfolio insights using GPT-4:
 * 1. Portfolio analysis and recommendations
 * 2. Risk assessment
 * 3. Diversification suggestions
 * 4. Market trend analysis
 * 5. Rebalancing recommendations
 */

import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'
import { createSupabaseClient } from '../_shared/supabase-client.ts'

interface Position {
  ticker: string
  quantity: number
  average_price: number
  current_price: number
  value: number
  gain_loss: number
  gain_loss_percentage: number
  asset_type: string
}

interface PortfolioMetrics {
  sharpe_ratio: number
  sortino_ratio: number
  max_drawdown: number
  var_95: number
  beta: number
  alpha: number
  annualized_return: number
  annualized_volatility: number
}

async function generateInsightsWithGPT4(
  positions: Position[],
  metrics: PortfolioMetrics | null,
  totalValue: number
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // Calculate allocation percentages
  const allocations = positions.map((p) => ({
    ticker: p.ticker,
    percentage: (p.value / totalValue) * 100,
    gainLoss: p.gain_loss_percentage,
    assetType: p.asset_type,
  }))

  // Sort by allocation
  allocations.sort((a, b) => b.percentage - a.percentage)

  const prompt = `You are a professional financial advisor analyzing an investment portfolio.

Portfolio Overview:
- Total Value: £${totalValue.toLocaleString()}
- Number of Holdings: ${positions.length}

Top Holdings:
${allocations
  .slice(0, 10)
  .map(
    (a) =>
      `- ${a.ticker}: ${a.percentage.toFixed(1)}% (${a.gainLoss >= 0 ? '+' : ''}${a.gainLoss.toFixed(1)}%)`
  )
  .join('\n')}

Performance Metrics:
${
  metrics
    ? `
- Sharpe Ratio: ${metrics.sharpe_ratio?.toFixed(2) || 'N/A'}
- Sortino Ratio: ${metrics.sortino_ratio?.toFixed(2) || 'N/A'}
- Maximum Drawdown: ${((metrics.max_drawdown || 0) * 100).toFixed(2)}%
- Annualized Return: ${((metrics.annualized_return || 0) * 100).toFixed(2)}%
- Annualized Volatility: ${((metrics.annualized_volatility || 0) * 100).toFixed(2)}%
- Beta: ${metrics.beta?.toFixed(2) || 'N/A'}
- Alpha: ${((metrics.alpha || 0) * 100).toFixed(2)}%
`
    : 'Metrics data not available yet.'
}

Please provide:
1. Portfolio Health Assessment (2-3 sentences)
2. Top 3 Strengths (bullet points)
3. Top 3 Risks or Concerns (bullet points)
4. Diversification Analysis (2-3 sentences)
5. 3 Actionable Recommendations (bullet points)

Keep the analysis concise, professional, and actionable. Focus on practical insights for a retail investor.`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional financial advisor providing portfolio analysis and recommendations.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req)
  if (corsResponse) return corsResponse

  try {
    console.log('Starting AI portfolio insights generation...')
    const supabase = createSupabaseClient()

    // 1. Fetch current positions
    const { data: positions, error: positionsError } = await supabase.from('positions').select('*')

    if (positionsError) throw positionsError
    if (!positions || positions.length === 0) {
      throw new Error('No positions found in portfolio')
    }

    // 2. Fetch latest metrics
    const { data: metricsData, error: metricsError } = await supabase
      .from('portfolio_metrics')
      .select('*')
      .order('calculated_at', { ascending: false })
      .limit(1)

    if (metricsError) {
      console.warn('Could not fetch metrics:', metricsError)
    }

    const metrics = metricsData && metricsData.length > 0 ? metricsData[0] : null

    // 3. Calculate total portfolio value
    const totalValue = positions.reduce((sum, p) => sum + p.value, 0)

    // 4. Generate insights with GPT-4
    console.log('Generating insights with GPT-4...')
    const insights = await generateInsightsWithGPT4(positions, metrics, totalValue)

    // 5. Store insights in database
    const { error: insertError } = await supabase.from('portfolio_insights').insert({
      insights_text: insights,
      generated_at: new Date().toISOString(),
      total_value: totalValue,
      positions_count: positions.length,
    })

    if (insertError) {
      console.error('Error storing insights:', insertError)
      throw insertError
    }

    console.log('AI insights generated successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'AI insights generated successfully',
        data: {
          insights,
          totalValue,
          positionsCount: positions.length,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('AI insights generation error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
