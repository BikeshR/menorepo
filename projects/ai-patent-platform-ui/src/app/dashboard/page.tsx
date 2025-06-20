'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, FileText, Clock, CheckCircle, Edit, Brain, TrendingUp, AlertCircle } from 'lucide-react'

export default function DashboardPage() {
  const user = { name: 'John Doe' }
  
  // Dashboard stats
  const stats = {
    totalPatents: 47,
    pendingApplications: 12,
    grantedPatents: 28,
    draftPatents: 7,
    aiTasks: 3,
    portfolioHealth: 87,
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '30px', 
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#111827'
          }}>
            Portfolio Dashboard
          </h1>
          <p style={{ color: '#6B7280', fontSize: '16px' }}>
            Welcome back, {user?.name}. Here's your patent portfolio overview.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button style={{ backgroundColor: '#1E40AF', color: 'white', padding: '8px 16px' }} asChild>
            <Link href="/invention-wizard">
              <Plus className="mr-2 h-4 w-4" />
              New Invention
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/ai-analysis">
              <Brain className="mr-2 h-4 w-4" />
              AI Analysis
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        {/* Active Patents Card */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6B7280' }}>Active Patents</h3>
            <FileText style={{ width: '20px', height: '20px', color: '#9CA3AF' }} />
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
            {stats.totalPatents}
          </div>
          <p style={{ fontSize: '12px', color: '#6B7280' }}>
            <span style={{ color: '#059669' }}>+5</span> from last month
          </p>
        </div>

        {/* Pending Applications Card */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #FED7AA',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6B7280' }}>Pending Applications</h3>
            <Clock style={{ width: '20px', height: '20px', color: '#9CA3AF' }} />
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
            {stats.pendingApplications}
          </div>
          <p style={{ fontSize: '12px', color: '#6B7280' }}>
            <span style={{ color: '#D97706' }}>3 require action</span>
          </p>
        </div>

        {/* AI Tasks Card */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E9D5FF',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6B7280' }}>AI Tasks</h3>
            <Brain style={{ width: '20px', height: '20px', color: '#9CA3AF' }} />
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
            {stats.aiTasks}
          </div>
          <p style={{ fontSize: '12px', color: '#6B7280' }}>
            <span style={{ color: '#7C3AED' }}>Processing</span>
          </p>
        </div>

        {/* Portfolio Health Card */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #BBF7D0',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6B7280' }}>Portfolio Health</h3>
            <TrendingUp style={{ width: '20px', height: '20px', color: '#9CA3AF' }} />
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
            {stats.portfolioHealth}/100
          </div>
          <p style={{ fontSize: '12px', color: '#059669' }}>
            Good health
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px'
      }}>
        {/* Recent Activity */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>
            Recent Activity
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Activity Item 1 */}
            <div style={{ 
              padding: '16px',
              backgroundColor: '#F9FAFB',
              borderRadius: '6px',
              border: '1px solid #E5E7EB'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h4 style={{ fontWeight: '500', fontSize: '14px', marginBottom: '4px' }}>
                    Patent Application #US2024-1234
                  </h4>
                  <p style={{ fontSize: '12px', color: '#6B7280' }}>
                    Machine Learning Algorithm for Patent Classification
                  </p>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '12px', fontSize: '12px' }}>
                    <span style={{ color: '#2563EB' }}>Status: Pending</span>
                    <span style={{ color: '#059669' }}>AI: 92% confidence</span>
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>2 hours ago</span>
              </div>
            </div>

            {/* Activity Item 2 */}
            <div style={{ 
              padding: '16px',
              backgroundColor: '#F9FAFB',
              borderRadius: '6px',
              border: '1px solid #E5E7EB'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h4 style={{ fontWeight: '500', fontSize: '14px', marginBottom: '4px' }}>
                    Invention Disclosure #INV-5678
                  </h4>
                  <p style={{ fontSize: '12px', color: '#6B7280' }}>
                    Quantum Computing Circuit Optimization
                  </p>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '12px', fontSize: '12px' }}>
                    <span style={{ color: '#D97706' }}>Status: Under Review</span>
                    <span style={{ color: '#7C3AED' }}>AI Processing</span>
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>5 hours ago</span>
              </div>
            </div>

            {/* Activity Item 3 */}
            <div style={{ 
              padding: '16px',
              backgroundColor: '#F9FAFB',
              borderRadius: '6px',
              border: '1px solid #E5E7EB'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h4 style={{ fontWeight: '500', fontSize: '14px', marginBottom: '4px' }}>
                    Prior Art Search Completed
                  </h4>
                  <p style={{ fontSize: '12px', color: '#6B7280' }}>
                    Biomedical Sensor Device - 47 relevant references found
                  </p>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '12px', fontSize: '12px' }}>
                    <span style={{ color: '#059669' }}>Status: Completed</span>
                    <span style={{ color: '#1E40AF' }}>View Report</span>
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>Yesterday</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights Panel */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>
            AI Insights
          </h2>
          
          {/* Portfolio Gaps */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
              Portfolio Gaps
            </h3>
            <div style={{
              padding: '12px',
              backgroundColor: '#EFF6FF',
              borderRadius: '6px',
              border: '1px solid #DBEAFE',
              fontSize: '14px',
              color: '#1E40AF'
            }}>
              <AlertCircle style={{ width: '16px', height: '16px', marginBottom: '4px' }} />
              Consider filing in blockchain and distributed systems space based on your research trends.
            </div>
          </div>

          {/* Priority Actions */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
              Priority Actions
            </h3>
            <div style={{
              padding: '12px',
              backgroundColor: '#FEF3C7',
              borderRadius: '6px',
              border: '1px solid #FDE68A',
              fontSize: '14px',
              color: '#92400E'
            }}>
              3 office action deadlines approaching in the next 30 days
            </div>
          </div>

          {/* Competitive Alerts */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
              Competitive Alerts
            </h3>
            <div style={{
              padding: '12px',
              backgroundColor: '#FEE2E2',
              borderRadius: '6px',
              border: '1px solid #FECACA',
              fontSize: '14px',
              color: '#991B1B'
            }}>
              2 new competitor filings detected in your technology areas
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}