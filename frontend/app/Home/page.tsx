"use client"
import { useMemo } from 'react'
import useSWR from 'swr'
import './page.css'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function DashboardPage() {
  // Fetch attempt history
  const { data: attempts, error } = useSWR('/api/histories', fetcher)

  // Filter only graded attempts (attempts with results)
  const gradedAttempts = useMemo(() => {
    if (!attempts || !Array.isArray(attempts)) return []
    return attempts.filter(att => att.result && typeof att.result.correct === 'number' && att.result.total > 0)
  }, [attempts])

  const stats = useMemo(() => {
    const totalCount = gradedAttempts.length
    
    // IELTS Attempts
    const ieltsAttempts = gradedAttempts.filter(att => !att.skill.startsWith('toeic_'))
    const ieltsAvg = ieltsAttempts.length > 0
      ? Math.round(ieltsAttempts.reduce((acc, curr) => acc + (curr.result.correct / curr.result.total), 0) / ieltsAttempts.length * 100)
      : null

    // TOEIC Attempts
    const toeicAttempts = gradedAttempts.filter(att => att.skill.startsWith('toeic_'))
    const toeicAvg = toeicAttempts.length > 0
      ? Math.round(toeicAttempts.reduce((acc, curr) => acc + (curr.result.correct / curr.result.total), 0) / toeicAttempts.length * 100)
      : null

    return {
      totalCount,
      ieltsAvg,
      toeicAvg
    }
  }, [gradedAttempts])

  // Get last 7 graded attempts in chronological order for the chart
  const chartData = useMemo(() => {
    const lastSeven = gradedAttempts.slice(0, 7).reverse()
    return lastSeven.map(att => {
      const isToeic = att.skill.startsWith('toeic_')
      const bookLabel = isToeic ? `TOEIC ${att.book}` : `Cam ${att.book}`
      const skillShort = isToeic 
        ? att.skill.replace('toeic_', '').toUpperCase()
        : att.skill.charAt(0).toUpperCase() + att.skill.slice(1, 3)
      return {
        label: `${bookLabel} T${att.test} (${skillShort})`,
        percent: Math.round((att.result.correct / att.result.total) * 100),
        score: `${att.result.correct}/${att.result.total}`
      }
    })
  }, [gradedAttempts])

  return (
    <div className="dashboard-view fade-in">
      {error && (
        <div className="home-error">
          ⚠️ Failed to load history attempts. Please verify that the backend server is running.
        </div>
      )}

      <div className="dashboard-header">
        <h2 className="dashboard-main-title">📈 Learning Dashboard</h2>
        <p className="dashboard-subtitle">Track your overall practice history, average score accuracy, and recent learning trends.</p>
      </div>

      {/* Overall stats cards */}
      <div className="stats-container">
        <div className="stat-widget">
          <div className="stat-widget__value">{stats.totalCount}</div>
          <div className="stat-widget__label">Completed Tests</div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget__value" style={{ color: 'var(--ielts-red)' }}>
            {stats.ieltsAvg !== null ? `${stats.ieltsAvg}%` : '---'}
          </div>
          <div className="stat-widget__label">IELTS Avg Accuracy</div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget__value" style={{ color: 'var(--status-correct, #22c55e)' }}>
            {stats.toeicAvg !== null ? `${stats.toeicAvg}%` : '---'}
          </div>
          <div className="stat-widget__label">TOEIC Avg Accuracy</div>
        </div>
      </div>

      {/* SVG Trend Chart */}
      <div className="chart-section">
        <h3 className="chart-section-title">📊 Learning Progress (Last 7 Attempts)</h3>
        <div className="chart-wrapper">
          {chartData.length === 0 ? (
            <div className="chart-placeholder">
              <span>📊 No practice attempts found. Navigate to the Practice Tests section in the sidebar to start!</span>
            </div>
          ) : (
            <div>
              <h4 className="chart-subtitle-label">Correct Answers Ratio (%)</h4>
              <svg viewBox="0 0 520 220" className="trend-chart-svg">
                {/* Grid lines */}
                <line x1="40" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="67.5" x2="500" y2="67.5" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="105" x2="500" y2="105" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="142.5" x2="500" y2="142.5" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="180" x2="500" y2="180" stroke="#cbd5e1" strokeWidth="2" />
                
                {/* Y-Axis labels */}
                <text x="30" y="34" className="chart-text chart-text--axis">100</text>
                <text x="30" y="71.5" className="chart-text chart-text--axis">75</text>
                <text x="30" y="109" className="chart-text chart-text--axis">50</text>
                <text x="30" y="146.5" className="chart-text chart-text--axis">25</text>
                <text x="35" y="184" className="chart-text chart-text--axis">0</text>

                {/* Benchmark lines */}
                <line x1="40" y1="60" x2="500" y2="60" stroke="#22c55e" strokeDasharray="4 4" strokeWidth="1" opacity="0.6" />
                <text x="450" y="55" fill="#22c55e" className="chart-text chart-text--badge">Goal 80%</text>

                {/* Render bars */}
                {chartData.map((item, idx) => {
                  const barWidth = 40
                  const spacing = 62
                  const xPos = idx * spacing + 50
                  const barHeight = (item.percent / 100) * 150
                  const yPos = 180 - barHeight
                  const isToeic = item.label.includes('TOEIC')

                  return (
                    <g key={idx}>
                      {/* Bar rect */}
                      <rect
                        x={xPos}
                        y={yPos}
                        width={barWidth}
                        height={barHeight}
                        rx="4"
                        fill={isToeic ? 'url(#toeicGrad)' : 'url(#ieltsGrad)'}
                        className="chart-bar-rect"
                      />
                      {/* Score Text inside/above bar */}
                      <text
                        x={xPos + barWidth / 2}
                        y={yPos - 6}
                        textAnchor="middle"
                        className="chart-text chart-text--val"
                      >
                        {item.percent}%
                      </text>
                      {/* Label text rotated below bar */}
                      <text
                        x={xPos + barWidth / 2}
                        y="196"
                        textAnchor="middle"
                        className="chart-text chart-text--label"
                      >
                        {item.label.split(' ')[0]} {item.label.split(' ')[2]}
                      </text>
                      <text
                        x={xPos + barWidth / 2}
                        y="208"
                        textAnchor="middle"
                        className="chart-text chart-text--score-label"
                      >
                        {item.score}
                      </text>
                    </g>
                  )
                })}

                {/* Gradients */}
                <defs>
                  <linearGradient id="ieltsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#fca5a5" />
                  </linearGradient>
                  <linearGradient id="toeicGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#86efac" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
