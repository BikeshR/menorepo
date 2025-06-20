"use client"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="border-b bg-card p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">AI Patent Platform</h1>
              <p className="text-muted-foreground">
                Next-generation patent management with AI assistance
              </p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                New Invention
              </button>
              <button className="px-4 py-2 bg-ai-processing text-white rounded-md hover:bg-ai-processing/90">
                AI Analysis
              </button>
            </div>
          </div>
        </header>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Active Patents</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">47</div>
              <div className="flex items-center text-xs text-ai-high-confidence">
                <span>+12% vs last month</span>
              </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Pending Applications</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">12</div>
              <div className="flex items-center text-xs text-ai-high-confidence">
                <span>+2 vs last month</span>
              </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">AI Tasks</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">3</div>
              <div className="flex items-center text-xs text-ai-processing">
                <span className="animate-ai-pulse">Processing...</span>
              </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Portfolio Value</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">$2.4M</div>
              <div className="flex items-center text-xs text-ai-high-confidence">
                <span>+15% vs last quarter</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Confidence Demo */}
          <div className="bg-card p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">AI Confidence Indicators</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm">High Confidence (92%):</span>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`w-3 h-3 rounded-full ${i <= 5 ? 'bg-ai-high-confidence' : 'bg-gray-300'}`} />
                  ))}
                </div>
                <span className="text-xs bg-ai-high-confidence text-white px-2 py-1 rounded">92%</span>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-sm">Medium Confidence (76%):</span>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`w-3 h-3 rounded-full ${i <= 4 ? 'bg-ai-medium-confidence' : 'bg-gray-300'}`} />
                  ))}
                </div>
                <span className="text-xs bg-ai-medium-confidence text-white px-2 py-1 rounded">76%</span>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-sm">Low Confidence (45%):</span>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`w-3 h-3 rounded-full ${i <= 2 ? 'bg-ai-low-confidence' : 'bg-gray-300'}`} />
                  ))}
                </div>
                <span className="text-xs bg-ai-low-confidence text-white px-2 py-1 rounded">45%</span>
              </div>
            </div>
          </div>

          {/* Patent Status Demo */}
          <div className="bg-card p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Patent Status Types</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-patent-pending text-white text-xs rounded-full">Pending</span>
                <span className="text-sm">Application filed, awaiting examination</span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-patent-granted text-white text-xs rounded-full">Granted</span>
                <span className="text-sm">Patent approved and issued</span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-patent-rejected text-white text-xs rounded-full">Rejected</span>
                <span className="text-sm">Application denied by patent office</span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-patent-abandoned text-white text-xs rounded-full">Abandoned</span>
                <span className="text-sm">Application withdrawn or expired</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Processing Demo */}
        <div className="bg-card p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">AI Processing Simulation</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-ai-processing animate-ai-pulse"></div>
              <span>Analyzing patent landscape...</span>
            </div>
            
            <div className="w-full bg-secondary rounded-full h-2">
              <div className="bg-gradient-to-r from-ai-processing to-ai-high-confidence h-2 rounded-full animate-ai-pulse" style={{width: '65%'}}></div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Processing 1,247 patents • Estimated time remaining: 45 seconds
            </div>
            
            <div className="bg-muted/30 rounded-md p-3 border-l-2 border-ai-processing">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Preview (updating in real-time):
              </p>
              <div className="text-sm text-foreground/80 font-mono leading-relaxed">
                Generating patent claims for AI-powered search algorithm...
                <span className="animate-ai-pulse">|</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Showcase */}
        <div className="bg-card p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">🚀 Phase 3 Complete: Design System & Component Library</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">✅ Components Built:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• AI Confidence Indicators</li>
                <li>• AI Suggestion Cards</li>
                <li>• AI Streaming Progress</li>
                <li>• Patent Status Badges</li>
                <li>• Prior Art Cards</li>
                <li>• Dashboard Metrics</li>
                <li>• Sidebar Navigation</li>
                <li>• Wizard Progress</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">✅ Design System:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Custom AI color palette</li>
                <li>• Patent-specific tokens</li>
                <li>• Tailwind CSS 4 integration</li>
                <li>• TypeScript interfaces</li>
                <li>• Responsive breakpoints</li>
                <li>• Animation utilities</li>
                <li>• Accessibility compliance</li>
                <li>• Performance optimizations</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-ai-high-confidence/10 border border-ai-high-confidence/20 rounded-md">
            <p className="text-sm">
              <strong>🎉 Next.js 15 + React 19 + Tailwind CSS 4 + TypeScript 5.8</strong><br/>
              Ready for Phase 4: Core Architecture & Foundation implementation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}