'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, FileText, Search, Filter, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react'

export default function PatentsPage() {
  const patents = [
    {
      id: 'US2024-1234',
      title: 'Machine Learning Algorithm for Patent Classification',
      status: 'pending',
      statusLabel: 'Pending',
      filingDate: 'Jan 15, 2024',
      lastUpdate: '2 days ago',
      aiConfidence: 92,
      description: 'An innovative ML algorithm that automatically classifies patent applications based on technical content and prior art analysis.'
    },
    {
      id: 'US2023-8765',
      title: 'Quantum Computing Circuit Optimization',
      status: 'granted',
      statusLabel: 'Granted',
      filingDate: 'Nov 20, 2023',
      lastUpdate: '1 month ago',
      aiConfidence: 88,
      description: 'Method and system for optimizing quantum circuit designs using topology-aware algorithms.'
    },
    {
      id: 'US2023-5432',
      title: 'Biomedical Sensor Device',
      status: 'rejected',
      statusLabel: 'Rejected',
      filingDate: 'Sep 5, 2023',
      lastUpdate: '3 weeks ago',
      aiConfidence: 76,
      description: 'A novel biosensor for real-time monitoring of multiple biomarkers in patient blood samples.'
    },
    {
      id: 'US2024-2468',
      title: 'Blockchain-based Supply Chain Management System',
      status: 'pending',
      statusLabel: 'Under Review',
      filingDate: 'Feb 28, 2024',
      lastUpdate: '5 days ago',
      aiConfidence: 94,
      description: 'Decentralized system for tracking and verifying supply chain data using blockchain technology.'
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'granted':
        return { border: '#BBF7D0', bg: '#F0FDF4', text: '#059669' }
      case 'pending':
        return { border: '#FED7AA', bg: '#FFF7ED', text: '#D97706' }
      case 'rejected':
        return { border: '#FECACA', bg: '#FEF2F2', text: '#DC2626' }
      default:
        return { border: '#E5E7EB', bg: '#F9FAFB', text: '#6B7280' }
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'granted':
        return <CheckCircle style={{ width: '16px', height: '16px' }} />
      case 'pending':
        return <Clock style={{ width: '16px', height: '16px' }} />
      case 'rejected':
        return <XCircle style={{ width: '16px', height: '16px' }} />
      default:
        return <FileText style={{ width: '16px', height: '16px' }} />
    }
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
            Patent Portfolio
          </h1>
          <p style={{ color: '#6B7280', fontSize: '16px' }}>
            Manage and track all your patent applications and grants
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button style={{ backgroundColor: '#1E40AF', color: 'white', padding: '8px 16px' }} asChild>
            <Link href="/patents/create">
              <Plus className="mr-2 h-4 w-4" />
              New Patent
            </Link>
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        <div style={{
          flex: '1',
          minWidth: '300px',
          position: 'relative'
        }}>
          <Search style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            color: '#9CA3AF'
          }} />
          <input
            type="text"
            placeholder="Search patents by title, ID, or keyword..."
            style={{
              width: '100%',
              padding: '8px 8px 8px 36px',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>
        <Button variant="outline" style={{
          padding: '8px 16px',
          backgroundColor: 'white',
          border: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer'
        }}>
          <Filter style={{ width: '16px', height: '16px' }} />
          Filter
        </Button>
        <Button variant="outline" style={{
          padding: '8px 16px',
          backgroundColor: 'white',
          border: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer'
        }}>
          <Calendar style={{ width: '16px', height: '16px' }} />
          Date Range
        </Button>
      </div>

      {/* Patents List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {patents.map((patent) => {
          const statusStyle = getStatusColor(patent.status)
          return (
            <div
              key={patent.id}
              style={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                      {patent.title}
                    </h3>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      border: `1px solid ${statusStyle.border}`,
                      backgroundColor: statusStyle.bg,
                      color: statusStyle.text,
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      {getStatusIcon(patent.status)}
                      {patent.statusLabel}
                    </div>
                  </div>
                  <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
                    {patent.description}
                  </p>
                  <div style={{ display: 'flex', gap: '24px', fontSize: '12px', color: '#6B7280' }}>
                    <span><strong>ID:</strong> {patent.id}</span>
                    <span><strong>Filed:</strong> {patent.filingDate}</span>
                    <span><strong>Last Update:</strong> {patent.lastUpdate}</span>
                    <span style={{ color: '#059669' }}>
                      <strong>AI Confidence:</strong> {patent.aiConfidence}%
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  marginLeft: '16px'
                }}>
                  View Details
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}