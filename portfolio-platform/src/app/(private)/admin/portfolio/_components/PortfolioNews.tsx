import { ExternalLink, TrendingDown, TrendingUp } from 'lucide-react'
import type { NewsArticle } from '@/lib/integrations/alphavantage'

interface PortfolioNewsProps {
  articles: NewsArticle[]
}

export function PortfolioNews({ articles }: PortfolioNewsProps) {
  if (articles.length === 0) {
    return null
  }

  const formatDate = (dateString: string) => {
    // Alpha Vantage format: YYYYMMDDTHHMMSS
    const year = dateString.slice(0, 4)
    const month = dateString.slice(4, 6)
    const day = dateString.slice(6, 8)
    const hour = dateString.slice(9, 11)
    const minute = dateString.slice(11, 13)

    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) {
      return 'Just now'
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getSentimentColor = (sentiment: string) => {
    const lower = sentiment.toLowerCase()
    if (lower.includes('bullish') || lower.includes('positive')) {
      return 'text-green-600 dark:text-green-400'
    }
    if (lower.includes('bearish') || lower.includes('negative')) {
      return 'text-red-600 dark:text-red-400'
    }
    return 'text-muted-foreground'
  }

  const getSentimentIcon = (sentiment: string) => {
    const lower = sentiment.toLowerCase()
    if (lower.includes('bullish') || lower.includes('positive')) {
      return <TrendingUp className="h-3 w-3" />
    }
    if (lower.includes('bearish') || lower.includes('negative')) {
      return <TrendingDown className="h-3 w-3" />
    }
    return null
  }

  return (
    <div className="border rounded-lg p-6 bg-card">
      <h2 className="text-xl font-semibold mb-4">Portfolio News</h2>
      <div className="space-y-4">
        {articles.map((article) => (
          <a
            key={article.url}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Title */}
                <h3 className="font-semibold mb-1 line-clamp-2 hover:underline">{article.title}</h3>

                {/* Summary */}
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{article.summary}</p>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{article.source}</span>
                  <span>•</span>
                  <span>{formatDate(article.time_published)}</span>

                  {/* Sentiment Badge */}
                  {article.overall_sentiment_label && (
                    <>
                      <span>•</span>
                      <span
                        className={`flex items-center gap-1 ${getSentimentColor(article.overall_sentiment_label)}`}
                      >
                        {getSentimentIcon(article.overall_sentiment_label)}
                        {article.overall_sentiment_label}
                      </span>
                    </>
                  )}
                </div>

                {/* Related Tickers */}
                {article.ticker_sentiment && article.ticker_sentiment.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {article.ticker_sentiment.slice(0, 3).map((ts) => (
                      <span
                        key={ts.ticker}
                        className="px-2 py-0.5 bg-muted rounded text-xs font-medium"
                      >
                        {ts.ticker}
                      </span>
                    ))}
                    {article.ticker_sentiment.length > 3 && (
                      <span className="px-2 py-0.5 text-xs text-muted-foreground">
                        +{article.ticker_sentiment.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* External Link Icon */}
              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
