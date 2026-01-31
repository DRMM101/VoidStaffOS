/**
 * VoidStaffOS - Absence Pattern Detection Service
 * Analyzes absence data to detect patterns for HR wellbeing review.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 2026-01-31
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: Absence Insights
 */

const db = require('../config/database');

// Configurable thresholds
const THRESHOLDS = {
  frequency: {
    absences_per_90_days: 3,      // 3+ absences in 90 days
    absences_per_year: 6          // 6+ absences in 12 months
  },
  monday_friday: {
    percentage: 50,                // 50%+ of absences on Mon/Fri
    min_absences: 4                // Minimum absences to detect
  },
  post_holiday: {
    occurrences: 2,                // 2+ times absent after leave
    days_after: 2                  // Within 2 days of returning
  },
  duration_trend: {
    increase_percentage: 50,       // 50%+ increase in avg duration
    min_periods: 2                 // Need at least 2 periods to compare
  },
  short_notice: {
    same_day_count: 3,             // 3+ same-day reports in 90 days
    percentage: 40                 // 40%+ of absences are same-day
  }
};

/**
 * Run all pattern detection for an employee
 * @param {number} tenantId - Tenant ID
 * @param {number} employeeId - Employee ID
 * @returns {Array} - Array of detected insights
 */
async function detectPatterns(tenantId, employeeId) {
  const insights = [];

  // Get last 12 months of absences
  const absencesResult = await db.query(`
    SELECT id, absence_category, sick_reason, leave_start_date, leave_end_date,
           status, notice_days, created_at,
           EXTRACT(DOW FROM leave_start_date) as day_of_week,
           (leave_end_date - leave_start_date + 1) as duration_days
    FROM leave_requests
    WHERE tenant_id = $1
      AND employee_id = $2
      AND absence_category IN ('sick', 'bereavement', 'compassionate')
      AND leave_start_date >= CURRENT_DATE - INTERVAL '12 months'
      AND status != 'cancelled'
    ORDER BY leave_start_date DESC
  `, [tenantId, employeeId]);

  const absences = absencesResult.rows;

  if (absences.length === 0) {
    return insights;
  }

  // Run each pattern detector
  const frequencyInsight = await detectFrequencyPattern(tenantId, employeeId, absences);
  if (frequencyInsight) insights.push(frequencyInsight);

  const mondayFridayInsight = await detectMondayFridayPattern(tenantId, employeeId, absences);
  if (mondayFridayInsight) insights.push(mondayFridayInsight);

  const postHolidayInsight = await detectPostHolidayPattern(tenantId, employeeId, absences);
  if (postHolidayInsight) insights.push(postHolidayInsight);

  const durationInsight = await detectDurationTrend(tenantId, employeeId, absences);
  if (durationInsight) insights.push(durationInsight);

  const shortNoticeInsight = await detectShortNoticePattern(tenantId, employeeId, absences);
  if (shortNoticeInsight) insights.push(shortNoticeInsight);

  const recurringReasonInsight = await detectRecurringReason(tenantId, employeeId, absences);
  if (recurringReasonInsight) insights.push(recurringReasonInsight);

  return insights;
}

/**
 * Detect high frequency of absences
 */
async function detectFrequencyPattern(tenantId, employeeId, absences) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentAbsences = absences.filter(a =>
    new Date(a.leave_start_date) >= ninetyDaysAgo
  );

  if (recentAbsences.length >= THRESHOLDS.frequency.absences_per_90_days) {
    const periodStart = ninetyDaysAgo.toISOString().split('T')[0];
    const periodEnd = new Date().toISOString().split('T')[0];

    // Check if similar insight already exists (not dismissed)
    const existing = await checkExistingInsight(tenantId, employeeId, 'frequency', periodStart);
    if (existing) return null;

    return {
      tenant_id: tenantId,
      employee_id: employeeId,
      pattern_type: 'frequency',
      priority: recentAbsences.length >= 5 ? 'high' : 'medium',
      period_start: periodStart,
      period_end: periodEnd,
      pattern_data: {
        count: recentAbsences.length,
        period_days: 90,
        threshold: THRESHOLDS.frequency.absences_per_90_days
      },
      related_absence_ids: recentAbsences.map(a => a.id),
      summary: `${recentAbsences.length} absences in the last 90 days (threshold: ${THRESHOLDS.frequency.absences_per_90_days})`
    };
  }

  return null;
}

/**
 * Detect Monday/Friday patterns (weekend extension)
 */
async function detectMondayFridayPattern(tenantId, employeeId, absences) {
  if (absences.length < THRESHOLDS.monday_friday.min_absences) {
    return null;
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentAbsences = absences.filter(a =>
    new Date(a.leave_start_date) >= sixMonthsAgo
  );

  if (recentAbsences.length < THRESHOLDS.monday_friday.min_absences) {
    return null;
  }

  // day_of_week: 0 = Sunday, 1 = Monday, 5 = Friday, 6 = Saturday
  const mondayCount = recentAbsences.filter(a => parseInt(a.day_of_week) === 1).length;
  const fridayCount = recentAbsences.filter(a => parseInt(a.day_of_week) === 5).length;
  const weekendAdjacent = mondayCount + fridayCount;
  const percentage = Math.round((weekendAdjacent / recentAbsences.length) * 100);

  if (percentage >= THRESHOLDS.monday_friday.percentage) {
    const periodStart = sixMonthsAgo.toISOString().split('T')[0];
    const periodEnd = new Date().toISOString().split('T')[0];

    const existing = await checkExistingInsight(tenantId, employeeId, 'monday_friday', periodStart);
    if (existing) return null;

    return {
      tenant_id: tenantId,
      employee_id: employeeId,
      pattern_type: 'monday_friday',
      priority: percentage >= 70 ? 'high' : 'medium',
      period_start: periodStart,
      period_end: periodEnd,
      pattern_data: {
        monday_count: mondayCount,
        friday_count: fridayCount,
        total_absences: recentAbsences.length,
        percentage: percentage
      },
      related_absence_ids: recentAbsences.filter(a =>
        parseInt(a.day_of_week) === 1 || parseInt(a.day_of_week) === 5
      ).map(a => a.id),
      summary: `${percentage}% of absences (${weekendAdjacent}/${recentAbsences.length}) fall on Monday or Friday`
    };
  }

  return null;
}

/**
 * Detect absences immediately after annual leave
 */
async function detectPostHolidayPattern(tenantId, employeeId, absences) {
  // Get annual leave in the last 12 months
  const holidaysResult = await db.query(`
    SELECT id, leave_end_date
    FROM leave_requests
    WHERE tenant_id = $1
      AND employee_id = $2
      AND absence_category = 'annual'
      AND status = 'approved'
      AND leave_end_date >= CURRENT_DATE - INTERVAL '12 months'
    ORDER BY leave_end_date DESC
  `, [tenantId, employeeId]);

  const holidays = holidaysResult.rows;
  if (holidays.length === 0) return null;

  const occurrences = [];

  for (const holiday of holidays) {
    const holidayEnd = new Date(holiday.leave_end_date);

    // Check for sick leave within THRESHOLDS.post_holiday.days_after days
    for (const absence of absences) {
      const absenceStart = new Date(absence.leave_start_date);
      const daysDiff = Math.floor((absenceStart - holidayEnd) / (1000 * 60 * 60 * 24));

      if (daysDiff >= 0 && daysDiff <= THRESHOLDS.post_holiday.days_after) {
        occurrences.push({
          holiday_end: holiday.leave_end_date,
          absence_start: absence.leave_start_date,
          absence_id: absence.id,
          days_after: daysDiff
        });
        break; // Only count once per holiday
      }
    }
  }

  if (occurrences.length >= THRESHOLDS.post_holiday.occurrences) {
    const periodStart = new Date();
    periodStart.setFullYear(periodStart.getFullYear() - 1);

    const existing = await checkExistingInsight(tenantId, employeeId, 'post_holiday',
      periodStart.toISOString().split('T')[0]);
    if (existing) return null;

    return {
      tenant_id: tenantId,
      employee_id: employeeId,
      pattern_type: 'post_holiday',
      priority: occurrences.length >= 3 ? 'high' : 'medium',
      period_start: periodStart.toISOString().split('T')[0],
      period_end: new Date().toISOString().split('T')[0],
      pattern_data: {
        occurrences: occurrences,
        threshold: THRESHOLDS.post_holiday.occurrences,
        days_window: THRESHOLDS.post_holiday.days_after
      },
      related_absence_ids: occurrences.map(o => o.absence_id),
      summary: `Absent within ${THRESHOLDS.post_holiday.days_after} day(s) of returning from annual leave on ${occurrences.length} occasions`
    };
  }

  return null;
}

/**
 * Detect increasing duration trend
 */
async function detectDurationTrend(tenantId, employeeId, absences) {
  // Group absences by quarter
  const quarters = {};

  for (const absence of absences) {
    const date = new Date(absence.leave_start_date);
    const quarter = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;

    if (!quarters[quarter]) {
      quarters[quarter] = { total_days: 0, count: 0 };
    }
    quarters[quarter].total_days += parseInt(absence.duration_days) || 1;
    quarters[quarter].count += 1;
  }

  const sortedQuarters = Object.entries(quarters)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, data]) => ({
      period,
      avg_days: Math.round((data.total_days / data.count) * 10) / 10
    }));

  if (sortedQuarters.length < THRESHOLDS.duration_trend.min_periods) {
    return null;
  }

  // Compare first half to second half (or first to last quarter)
  const firstAvg = sortedQuarters[0].avg_days;
  const lastAvg = sortedQuarters[sortedQuarters.length - 1].avg_days;

  if (firstAvg > 0 && lastAvg > firstAvg) {
    const increasePercent = Math.round(((lastAvg - firstAvg) / firstAvg) * 100);

    if (increasePercent >= THRESHOLDS.duration_trend.increase_percentage) {
      const periodStart = new Date();
      periodStart.setFullYear(periodStart.getFullYear() - 1);

      const existing = await checkExistingInsight(tenantId, employeeId, 'duration_trend',
        periodStart.toISOString().split('T')[0]);
      if (existing) return null;

      return {
        tenant_id: tenantId,
        employee_id: employeeId,
        pattern_type: 'duration_trend',
        priority: increasePercent >= 100 ? 'high' : 'medium',
        period_start: periodStart.toISOString().split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
        pattern_data: {
          periods: sortedQuarters,
          first_period_avg: firstAvg,
          last_period_avg: lastAvg,
          increase_percentage: increasePercent
        },
        related_absence_ids: absences.map(a => a.id),
        summary: `Average absence duration increased by ${increasePercent}% (from ${firstAvg} to ${lastAvg} days)`
      };
    }
  }

  return null;
}

/**
 * Detect frequent same-day (short notice) reporting
 */
async function detectShortNoticePattern(tenantId, employeeId, absences) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentAbsences = absences.filter(a =>
    new Date(a.leave_start_date) >= ninetyDaysAgo
  );

  if (recentAbsences.length < 3) return null;

  // Same-day reports have notice_days <= 0
  const sameDayReports = recentAbsences.filter(a =>
    (a.notice_days !== null && parseInt(a.notice_days) <= 0)
  );

  const percentage = Math.round((sameDayReports.length / recentAbsences.length) * 100);

  if (sameDayReports.length >= THRESHOLDS.short_notice.same_day_count ||
      percentage >= THRESHOLDS.short_notice.percentage) {

    const periodStart = ninetyDaysAgo.toISOString().split('T')[0];
    const periodEnd = new Date().toISOString().split('T')[0];

    const existing = await checkExistingInsight(tenantId, employeeId, 'short_notice', periodStart);
    if (existing) return null;

    return {
      tenant_id: tenantId,
      employee_id: employeeId,
      pattern_type: 'short_notice',
      priority: percentage >= 60 ? 'high' : 'medium',
      period_start: periodStart,
      period_end: periodEnd,
      pattern_data: {
        same_day_count: sameDayReports.length,
        total_absences: recentAbsences.length,
        percentage: percentage,
        threshold_count: THRESHOLDS.short_notice.same_day_count,
        threshold_percentage: THRESHOLDS.short_notice.percentage
      },
      related_absence_ids: sameDayReports.map(a => a.id),
      summary: `${sameDayReports.length} same-day absence reports (${percentage}% of recent absences)`
    };
  }

  return null;
}

/**
 * Detect recurring same reason
 */
async function detectRecurringReason(tenantId, employeeId, absences) {
  const sickAbsences = absences.filter(a =>
    a.absence_category === 'sick' && a.sick_reason
  );

  if (sickAbsences.length < 3) return null;

  // Count by reason
  const reasonCounts = {};
  for (const absence of sickAbsences) {
    const reason = absence.sick_reason;
    if (!reasonCounts[reason]) {
      reasonCounts[reason] = { count: 0, absences: [] };
    }
    reasonCounts[reason].count += 1;
    reasonCounts[reason].absences.push(absence.id);
  }

  // Find reason that occurs 3+ times
  for (const [reason, data] of Object.entries(reasonCounts)) {
    if (data.count >= 3) {
      const periodStart = new Date();
      periodStart.setFullYear(periodStart.getFullYear() - 1);

      const existing = await checkExistingInsight(tenantId, employeeId, 'recurring_reason',
        periodStart.toISOString().split('T')[0]);
      if (existing) return null;

      const reasonLabels = {
        illness: 'General illness',
        injury: 'Injury',
        mental_health: 'Mental health',
        medical_appointment: 'Medical appointments',
        other: 'Other reasons'
      };

      return {
        tenant_id: tenantId,
        employee_id: employeeId,
        pattern_type: 'recurring_reason',
        priority: data.count >= 5 ? 'high' : 'low',
        period_start: periodStart.toISOString().split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
        pattern_data: {
          reason: reason,
          reason_label: reasonLabels[reason] || reason,
          count: data.count,
          total_sick_absences: sickAbsences.length
        },
        related_absence_ids: data.absences,
        summary: `${data.count} absences citing "${reasonLabels[reason] || reason}" in the last 12 months`
      };
    }
  }

  return null;
}

/**
 * Check if similar insight already exists and is not dismissed
 */
async function checkExistingInsight(tenantId, employeeId, patternType, periodStart) {
  const result = await db.query(`
    SELECT id FROM absence_insights
    WHERE tenant_id = $1
      AND employee_id = $2
      AND pattern_type = $3
      AND period_start >= $4::date - INTERVAL '30 days'
      AND status NOT IN ('dismissed')
    LIMIT 1
  `, [tenantId, employeeId, patternType, periodStart]);

  return result.rows.length > 0;
}

/**
 * Save detected insights to database
 */
async function saveInsights(insights) {
  const saved = [];

  for (const insight of insights) {
    const result = await db.query(`
      INSERT INTO absence_insights (
        tenant_id, employee_id, pattern_type, priority,
        period_start, period_end, pattern_data,
        related_absence_ids, summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      insight.tenant_id,
      insight.employee_id,
      insight.pattern_type,
      insight.priority,
      insight.period_start,
      insight.period_end,
      JSON.stringify(insight.pattern_data),
      insight.related_absence_ids,
      insight.summary
    ]);

    saved.push({ ...insight, id: result.rows[0].id });
  }

  return saved;
}

/**
 * Update employee's absence summary statistics
 */
async function updateEmployeeSummary(tenantId, employeeId) {
  // Get 12-month stats
  const statsResult = await db.query(`
    SELECT
      COUNT(*) as total_absences,
      COALESCE(SUM(leave_end_date - leave_start_date + 1), 0) as total_days,
      COALESCE(AVG(leave_end_date - leave_start_date + 1), 0) as avg_duration,
      COUNT(*) FILTER (WHERE EXTRACT(DOW FROM leave_start_date) = 1) as monday_count,
      COUNT(*) FILTER (WHERE EXTRACT(DOW FROM leave_start_date) = 5) as friday_count,
      COUNT(*) FILTER (WHERE notice_days <= 0) as same_day_count
    FROM leave_requests
    WHERE tenant_id = $1
      AND employee_id = $2
      AND absence_category IN ('sick', 'bereavement', 'compassionate')
      AND leave_start_date >= CURRENT_DATE - INTERVAL '12 months'
      AND status != 'cancelled'
  `, [tenantId, employeeId]);

  const stats = statsResult.rows[0];

  // Get last absence
  const lastAbsenceResult = await db.query(`
    SELECT leave_start_date,
           (leave_end_date - leave_start_date + 1) as duration,
           sick_reason
    FROM leave_requests
    WHERE tenant_id = $1
      AND employee_id = $2
      AND absence_category IN ('sick', 'bereavement', 'compassionate')
      AND status != 'cancelled'
    ORDER BY leave_start_date DESC
    LIMIT 1
  `, [tenantId, employeeId]);

  const lastAbsence = lastAbsenceResult.rows[0];

  // Calculate Bradford Factor: S² × D
  const spells = parseInt(stats.total_absences) || 0;
  const totalDays = parseInt(stats.total_days) || 0;
  const bradfordFactor = (spells * spells) * totalDays;

  // Upsert summary
  await db.query(`
    INSERT INTO absence_summaries (
      tenant_id, employee_id,
      total_sick_days_12m, total_absences_12m, avg_duration_12m,
      monday_absences_12m, friday_absences_12m, same_day_reports_12m,
      bradford_factor, bradford_updated_at,
      last_absence_date, last_absence_duration, last_absence_reason,
      calculated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11, $12, NOW())
    ON CONFLICT (tenant_id, employee_id)
    DO UPDATE SET
      total_sick_days_12m = EXCLUDED.total_sick_days_12m,
      total_absences_12m = EXCLUDED.total_absences_12m,
      avg_duration_12m = EXCLUDED.avg_duration_12m,
      monday_absences_12m = EXCLUDED.monday_absences_12m,
      friday_absences_12m = EXCLUDED.friday_absences_12m,
      same_day_reports_12m = EXCLUDED.same_day_reports_12m,
      bradford_factor = EXCLUDED.bradford_factor,
      bradford_updated_at = NOW(),
      last_absence_date = EXCLUDED.last_absence_date,
      last_absence_duration = EXCLUDED.last_absence_duration,
      last_absence_reason = EXCLUDED.last_absence_reason,
      calculated_at = NOW()
  `, [
    tenantId,
    employeeId,
    stats.total_days || 0,
    stats.total_absences || 0,
    parseFloat(stats.avg_duration) || 0,
    stats.monday_count || 0,
    stats.friday_count || 0,
    stats.same_day_count || 0,
    bradfordFactor,
    lastAbsence?.leave_start_date || null,
    lastAbsence?.duration || null,
    lastAbsence?.sick_reason || null
  ]);
}

/**
 * Run pattern detection after a new absence is recorded
 * Called from sickLeave controller after recording absence
 */
async function analyzeAfterAbsence(tenantId, employeeId) {
  try {
    // Update summary stats
    await updateEmployeeSummary(tenantId, employeeId);

    // Detect patterns
    const insights = await detectPatterns(tenantId, employeeId);

    // Save any new insights
    if (insights.length > 0) {
      const saved = await saveInsights(insights);
      console.log(`[AbsenceInsights] Created ${saved.length} insight(s) for employee ${employeeId}`);
      return saved;
    }

    return [];
  } catch (err) {
    console.error('[AbsenceInsights] Error analyzing patterns:', err);
    // Don't throw - pattern detection failure shouldn't block the main operation
    return [];
  }
}

module.exports = {
  detectPatterns,
  saveInsights,
  updateEmployeeSummary,
  analyzeAfterAbsence,
  THRESHOLDS
};
