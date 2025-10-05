/**
 * Check Milestones Edge Function
 *
 * This function runs periodically to:
 * 1. Fetch active milestones that haven't been achieved
 * 2. Check current portfolio metrics against milestone conditions
 * 3. Trigger milestone achievements
 * 4. Log achieved milestones
 */

import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'
import { createSupabaseClient } from '../_shared/supabase-client.ts'

interface Milestone {
  id: string
  milestone_type: string
  target_value: number
  current_value: number | null
  is_achieved: boolean
  title: string
  description: string | null
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req)
  if (corsResponse) return corsResponse

  try {
    console.log('Starting milestone check...')
    const supabase = createSupabaseClient()

    // 1. Fetch active milestones that haven't been achieved
    const { data: milestones, error: milestonesError } = await supabase
      .from('portfolio_milestones')
      .select('*')
      .eq('is_active', true)
      .eq('is_achieved', false)

    if (milestonesError) throw milestonesError

    if (!milestones || milestones.length === 0) {
      console.log('No active milestones to check')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active milestones to check',
          achievedCount: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    console.log(`Checking ${milestones.length} active milestones`)

    // 2. Fetch latest portfolio snapshot
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(1)

    if (snapshotsError) throw snapshotsError

    if (!snapshots || snapshots.length === 0) {
      throw new Error('No portfolio snapshots found')
    }

    const latestSnapshot = snapshots[0]

    // 3. Fetch positions count
    const { data: positions, error: positionsError } = await supabase.from('positions').select('id')

    if (positionsError) throw positionsError
    const holdingCount = positions ? positions.length : 0

    // 4. Calculate consecutive positive days
    const { data: recentSnapshots, error: recentSnapshotsError } = await supabase
      .from('portfolio_snapshots')
      .select('total_gain_loss_percentage, snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(30)

    if (recentSnapshotsError) throw recentSnapshotsError

    let consecutivePositiveDays = 0
    if (recentSnapshots) {
      for (const snapshot of recentSnapshots) {
        if (snapshot.total_gain_loss_percentage > 0) {
          consecutivePositiveDays++
        } else {
          break
        }
      }
    }

    // 5. Check each milestone
    const achievedMilestones: any[] = []

    for (const milestone of milestones) {
      let currentValue: number | null = null
      let isAchieved = false

      switch (milestone.milestone_type) {
        case 'portfolio_value':
          currentValue = latestSnapshot.total_value
          isAchieved = currentValue >= milestone.target_value
          break

        case 'total_return_percent':
          currentValue = latestSnapshot.total_gain_loss_percentage
          isAchieved = currentValue >= milestone.target_value
          break

        case 'total_return_amount':
          currentValue = latestSnapshot.total_gain_loss
          isAchieved = currentValue >= milestone.target_value
          break

        case 'portfolio_growth': {
          // Get first snapshot for growth calculation
          const { data: firstSnapshot } = await supabase
            .from('portfolio_snapshots')
            .select('total_value')
            .order('snapshot_date', { ascending: true })
            .limit(1)

          if (firstSnapshot && firstSnapshot.length > 0) {
            const growthPercent =
              ((latestSnapshot.total_value - firstSnapshot[0].total_value) /
                firstSnapshot[0].total_value) *
              100
            currentValue = growthPercent
            isAchieved = growthPercent >= milestone.target_value
          }
          break
        }

        case 'holding_count':
          currentValue = holdingCount
          isAchieved = holdingCount >= milestone.target_value
          break

        case 'consecutive_positive_days':
          currentValue = consecutivePositiveDays
          isAchieved = consecutivePositiveDays >= milestone.target_value
          break

        case 'best_performing_position': {
          const { data: bestPosition } = await supabase
            .from('positions')
            .select('gain_loss_percentage')
            .order('gain_loss_percentage', { ascending: false })
            .limit(1)

          if (bestPosition && bestPosition.length > 0) {
            currentValue = bestPosition[0].gain_loss_percentage
            isAchieved = currentValue >= milestone.target_value
          }
          break
        }

        case 'diversification_score':
          // Simple diversification: number of positions / total positions >= target (as percentage)
          currentValue = holdingCount
          isAchieved = holdingCount >= milestone.target_value
          break
      }

      if (isAchieved && currentValue !== null) {
        console.log(`Milestone achieved: ${milestone.title}`)

        // Update the milestone as achieved
        const { error: updateError } = await supabase
          .from('portfolio_milestones')
          .update({
            is_achieved: true,
            achieved_at: new Date().toISOString(),
            current_value: currentValue,
            notification_sent: true,
          })
          .eq('id', milestone.id)

        if (updateError) {
          console.error(`Error updating milestone ${milestone.id}:`, updateError)
          continue
        }

        // Log the achievement
        const message = `${milestone.title}: Achieved ${currentValue.toFixed(2)} (target: ${milestone.target_value.toFixed(2)})`

        const { error: logError } = await supabase.from('milestone_logs').insert({
          milestone_id: milestone.id,
          milestone_type: milestone.milestone_type,
          target_value: milestone.target_value,
          achieved_value: currentValue,
          title: milestone.title,
          message: message,
        })

        if (logError) {
          console.error(`Error logging milestone ${milestone.id}:`, logError)
        }

        achievedMilestones.push({
          title: milestone.title,
          milestone_type: milestone.milestone_type,
          achieved_value: currentValue,
          message: message,
        })

        // TODO: Send actual notification
      }
    }

    console.log(`Milestone check completed. Achieved: ${achievedMilestones.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Milestone check completed',
        checkedCount: milestones.length,
        achievedCount: achievedMilestones.length,
        achievedMilestones: achievedMilestones,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Milestone check error:', error)

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
