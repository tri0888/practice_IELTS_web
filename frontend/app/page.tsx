"use client"
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import './page.css'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const SKILL_ICONS: Record<string, { emoji: string; label: string; duration: string; questions: string; color: string }> = {
  listening: { emoji: '🎧', label: 'Listening', duration: '30 phút', questions: '40 câu', color: '#3b82f6' },
  reading: { emoji: '📖', label: 'Reading', duration: '60 phút', questions: '40 câu', color: '#22c55e' },
  writing: { emoji: '✍️', label: 'Writing', duration: '60 phút', questions: '2 bài', color: '#f59e0b' },
  speaking: { emoji: '🎙️', label: 'Speaking', duration: '11-14 phút', questions: '3 phần', color: '#8b5cf6' },
}

export default function TestLibraryPage() {
  const { data, error, isLoading } = useSWR('/api/tests', fetcher)
  
  // Fetch attempt history
  const { data: attempts } = useSWR('/api/attempts', fetcher)
  
  // Navigation States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ielts' | 'toeic'>('dashboard')
  const [selectedBook, setSelectedBook] = useState<number | null>(null)
  const [selectedToeicYear, setSelectedToeicYear] = useState<'2024' | '2026' | null>(null)
  
  // Skill selector modal state
  const [activeSkillModal, setActiveSkillModal] = useState<{
    bookOrYear: string | number
    testNum: number
    examType: 'ielts' | 'toeic'
  } | null>(null)

  // Group tests by book
  const testsByBook = useMemo(() => {
    if (!data || !Array.isArray(data)) return {}
    const grouped: Record<number, any[]> = {}
    data.forEach((t: any) => {
      const b = t.book ?? 11
      if (!grouped[b]) grouped[b] = []
      grouped[b].push(t)
    })
    // Sort tests within each book by test_number
    Object.keys(grouped).forEach((b: any) => {
      grouped[b].sort((a: any, b: any) => a.test_number - b.test_number)
    })
    return grouped
  }, [data])

  // Sorted list of Cambridge books (descending, newer first)
  const sortedBooks = useMemo(() => {
    return Object.keys(testsByBook).map(Number).sort((a, b) => b - a)
  }, [testsByBook])

  // Process stats and chart data
  const gradedAttempts = useMemo(() => {
    if (!attempts || !Array.isArray(attempts)) return []
    return attempts.filter(att => att.result && typeof att.result.correct === 'number' && att.result.total > 0)
  }, [attempts])

  const stats = useMemo(() => {
    const totalCount = gradedAttempts.length
    
    // IELTS Attempts
    const ieltsAttempts = gradedAttempts.filter(att => !att.skill.startsWith('ets_'))
    const ieltsAvg = ieltsAttempts.length > 0
      ? Math.round(ieltsAttempts.reduce((acc, curr) => acc + (curr.result.correct / curr.result.total), 0) / ieltsAttempts.length * 100)
      : null

    // TOEIC Attempts
    const toeicAttempts = gradedAttempts.filter(att => att.skill.startsWith('ets_'))
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
      const isToeic = att.skill.startsWith('ets_')
      const bookLabel = isToeic ? `ETS ${att.book}` : `Cam ${att.book}`
      const skillShort = isToeic 
        ? att.skill.replace('ets_', '').toUpperCase()
        : att.skill.charAt(0).toUpperCase() + att.skill.slice(1, 3)
      return {
        label: `${bookLabel} T${att.test} (${skillShort})`,
        percent: Math.round((att.result.correct / att.result.total) * 100),
        score: `${att.result.correct}/${att.result.total}`
      }
    })
  }, [gradedAttempts])

  return (
    <div className="homepage-container fade-in">
      {/* Sidebar Navigation */}
      <aside className="homepage-sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">🎓</span>
          <span className="sidebar-logo-text">Practice Hub</span>
        </div>
        <nav className="sidebar-menu">
          <button 
            className={`sidebar-menu-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('dashboard')
              setSelectedBook(null)
              setSelectedToeicYear(null)
            }}
          >
            <span className="sidebar-menu-icon">📊</span>
            <span className="sidebar-menu-label">Tổng quan</span>
          </button>
          <button 
            className={`sidebar-menu-btn ${activeTab === 'ielts' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('ielts')
              setSelectedBook(null)
              setSelectedToeicYear(null)
            }}
          >
            <span className="sidebar-menu-icon">🎯</span>
            <span className="sidebar-menu-label">Cambridge IELTS</span>
          </button>
          <button 
            className={`sidebar-menu-btn sidebar-menu-btn--toeic ${activeTab === 'toeic' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('toeic')
              setSelectedBook(null)
              setSelectedToeicYear(null)
            }}
          >
            <span className="sidebar-menu-icon">⏱️</span>
            <span className="sidebar-menu-label">ETS TOEIC</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="homepage-main-content">
        {error && (
          <div className="home-error">
            ⚠️ Không thể tải danh sách bài test. Hãy đảm bảo backend đang chạy.
          </div>
        )}

        {/* 1. Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-view fade-in">
            <div className="dashboard-header">
              <h2 className="dashboard-main-title">📈 Tổng quan kết quả làm bài</h2>
              <p className="dashboard-subtitle">Theo dõi quá trình luyện tập, tỷ lệ trả lời đúng trung bình và thống kê tiến độ gần đây của bạn.</p>
            </div>

            {/* Overall stats cards */}
            <div className="stats-container">
              <div className="stat-widget">
                <div className="stat-widget__value">{stats.totalCount}</div>
                <div className="stat-widget__label">Đã nộp bài</div>
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
              <h3 className="chart-section-title">📊 Tiến độ học tập (7 bài gần nhất)</h3>
              <div className="chart-wrapper">
                {chartData.length === 0 ? (
                  <div className="chart-placeholder">
                    <span>📊 Chưa có dữ liệu học tập. Hãy chuyển sang phần luyện thi và bắt đầu làm bài test!</span>
                  </div>
                ) : (
                  <div>
                    <h4 className="chart-subtitle-label">Tỷ lệ trả lời chính xác (%)</h4>
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
                        const isToeic = item.label.includes('ETS')

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
        )}

        {/* 2. Cambridge IELTS View */}
        {activeTab === 'ielts' && (
          <div className="fade-in">
            {selectedBook === null ? (
              <div className="book-selection-wrapper">
                <h2 className="choice-title">Chọn sách Cambridge IELTS</h2>
                <p className="choice-subtitle">Chọn tập sách Cambridge IELTS để xem danh sách các đề thi ôn tập chi tiết.</p>
                
                {isLoading && (
                  <div className="book-choices-grid">
                    {[19, 18, 17, 16, 15, 14, 13, 12, 11].map(i => (
                      <div key={i} className="skeleton" style={{ height: '140px', borderRadius: 'var(--radius-lg)' }} />
                    ))}
                  </div>
                )}

                {data && (
                  <div className="book-choices-grid">
                    {sortedBooks.map((book) => (
                      <div 
                        key={book} 
                        className="book-choice-card book-choice-card--ielts"
                        onClick={() => setSelectedBook(book)}
                      >
                        <div className="book-choice-card__icon">📕</div>
                        <h3 className="book-choice-card__title">Cam {book}</h3>
                        <p className="book-choice-card__subtitle">{testsByBook[book]?.length ?? 4} Tests Available</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="fade-in">
                <div className="subpage-header" style={{ marginBottom: '24px' }}>
                  <button className="btn-back" onClick={() => setSelectedBook(null)}>
                    ← Quay lại danh sách sách
                  </button>
                  <div className="nav-breadcrumb-indicator">
                    Cambridge IELTS › Cam {selectedBook}
                  </div>
                </div>

                <div className="home-book-header" style={{ marginBottom: '24px' }}>
                  <h2 className="home-book-title">Cambridge IELTS {selectedBook}</h2>
                  <p className="home-book-subtitle">Academic • Chọn đề thi bên dưới để bắt đầu luyện thi</p>
                </div>

                <div className="book-grid" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  {(testsByBook[selectedBook] ?? []).map((t: any) => (
                    <div
                      key={t.test_number}
                      className="test-card slide-up clickable-test-card"
                      onClick={() => setActiveSkillModal({ bookOrYear: selectedBook, testNum: t.test_number, examType: 'ielts' })}
                      style={{ animationDelay: `${(t.test_number - 1) * 80}ms` }}
                    >
                      <div className="test-card__header">
                        <div className="test-card__book">Cambridge IELTS {selectedBook}</div>
                        <div className="test-card__title">Test {t.test_number}</div>
                      </div>
                      <div className="test-card__body">
                        <div className="test-card__skills-preview">
                          {Object.values(SKILL_ICONS).map((s, idx) => (
                            <span key={idx} title={s.label}>{s.emoji}</span>
                          ))}
                        </div>
                        <div className="test-card__actions" style={{ marginTop: '16px' }}>
                          <button className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                            Chọn kỹ năng ôn tập
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. ETS TOEIC View */}
        {activeTab === 'toeic' && (
          <div className="fade-in">
            {selectedToeicYear === null ? (
              <div className="book-selection-wrapper">
                <h2 className="choice-title">Chọn bộ đề ETS TOEIC</h2>
                <p className="choice-subtitle">Chọn phiên bản năm phát hành của bộ đề ETS TOEIC để bắt đầu làm bài test.</p>
                <div className="book-choices-grid book-choices-grid--toeic">
                  <div 
                    className="book-choice-card book-choice-card--toeic"
                    onClick={() => setSelectedToeicYear('2026')}
                  >
                    <div className="book-choice-card__badge">Hot</div>
                    <div className="book-choice-card__icon">📘</div>
                    <h3 className="book-choice-card__title">ETS 2026</h3>
                    <p className="book-choice-card__subtitle">10 Tests (LC & RC)</p>
                  </div>

                  <div 
                    className="book-choice-card book-choice-card--toeic"
                    onClick={() => setSelectedToeicYear('2024')}
                  >
                    <div className="book-choice-card__icon">📘</div>
                    <h3 className="book-choice-card__title">ETS 2024</h3>
                    <p className="book-choice-card__subtitle">10 Tests (LC & RC)</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="fade-in">
                <div className="subpage-header" style={{ marginBottom: '24px' }}>
                  <button className="btn-back" onClick={() => setSelectedToeicYear(null)}>
                    ← Quay lại danh sách bộ đề
                  </button>
                  <div className="nav-breadcrumb-indicator">
                    ETS TOEIC › ETS {selectedToeicYear}
                  </div>
                </div>

                <div className="home-book-header" style={{ borderLeftColor: selectedToeicYear === '2024' ? '#3b82f6' : 'var(--status-correct, #22c55e)', marginBottom: '24px' }}>
                  <h2 className="home-book-title">ETS TOEIC {selectedToeicYear}</h2>
                  <p className="home-book-subtitle">Chọn đề thi để lựa chọn phần thi Listening (LC) hoặc Reading (RC)</p>
                </div>

                <div className="book-grid" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((testNum) => (
                    <div 
                      key={testNum} 
                      className="test-card slide-up clickable-test-card" 
                      onClick={() => setActiveSkillModal({ bookOrYear: selectedToeicYear, testNum: testNum, examType: 'toeic' })}
                      style={{ animationDelay: `${(testNum - 1) * 80}ms` }}
                    >
                      <div className="test-card__header">
                        <div className="test-card__book">ETS TOEIC {selectedToeicYear}</div>
                        <div className="test-card__title">Đề thi số {testNum}</div>
                      </div>
                      <div className="test-card__body">
                        <div className="test-card__skills-preview" style={{ justifyContent: 'center', gap: '16px', fontSize: '1.2rem' }}>
                          <span>🎧 Listening</span>
                          <span>📖 Reading</span>
                        </div>
                        <div className="test-card__actions" style={{ marginTop: '16px' }}>
                          <button className="btn btn-secondary btn-sm" style={{ width: '100%', background: selectedToeicYear === '2024' ? '#3b82f6' : 'var(--status-correct, #22c55e)', borderColor: selectedToeicYear === '2024' ? '#3b82f6' : 'var(--status-correct, #22c55e)', color: 'white' }}>
                            Chọn phần thi ôn tập
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================== */}
      {/* Skill Selection Modal (Popup)              */}
      {/* ========================================== */}
      {activeSkillModal !== null && (
        <div className="modal-overlay fade-in" onClick={() => setActiveSkillModal(null)}>
          <div className="modal-content slide-up-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  {activeSkillModal.examType === 'ielts' 
                    ? `Cambridge IELTS ${activeSkillModal.bookOrYear}`
                    : `ETS TOEIC ${activeSkillModal.bookOrYear}`}
                </h3>
                <p className="modal-subtitle">
                  {activeSkillModal.examType === 'ielts'
                    ? `Đề thi số ${activeSkillModal.testNum} • Hãy chọn kỹ năng luyện tập`
                    : `Đề thi số ${activeSkillModal.testNum} • Hãy chọn phần thi luyện tập`}
                </p>
              </div>
              <button className="modal-close" onClick={() => setActiveSkillModal(null)}>×</button>
            </div>
            
            <div className="modal-body">
              {activeSkillModal.examType === 'ielts' ? (
                /* IELTS Skills Grid inside Modal */
                <div className="modal-skills-grid">
                  {Object.entries(SKILL_ICONS).map(([skillKey, info]) => (
                    <Link
                      key={skillKey}
                      href={`/tests/${activeSkillModal.bookOrYear}/${activeSkillModal.testNum}/practice/${skillKey}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div className="modal-skill-card" style={{ borderLeftColor: info.color }}>
                        <div className="modal-skill-card__icon" style={{ color: info.color }}>
                          {info.emoji}
                        </div>
                        <div className="modal-skill-card__info">
                          <h4 className="modal-skill-card__name">{info.label}</h4>
                          <span className="modal-skill-card__meta">⏱️ {info.duration} • 📝 {info.questions}</span>
                        </div>
                        <div className="modal-skill-card__arrow">→</div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                /* TOEIC Skills Grid (LC & RC) inside Modal */
                <div className="modal-skills-grid modal-skills-grid--toeic">
                  <Link
                    href={`/tests/ets/${activeSkillModal.bookOrYear}/lc/${activeSkillModal.testNum}`}
                    style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}
                  >
                    <div className="modal-skill-card" style={{ borderLeftColor: '#3b82f6', height: '100%' }}>
                      <div className="modal-skill-card__icon" style={{ color: '#3b82f6' }}>🎧</div>
                      <div className="modal-skill-card__info">
                        <h4 className="modal-skill-card__name">Listening Section (LC)</h4>
                        <span className="modal-skill-card__meta">⏱️ 45 phút • 📝 100 câu (Part 1-4)</span>
                      </div>
                      <div className="modal-skill-card__arrow">→</div>
                    </div>
                  </Link>

                  <Link
                    href={`/tests/ets/${activeSkillModal.bookOrYear}/rc/${activeSkillModal.testNum}`}
                    style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}
                  >
                    <div className="modal-skill-card" style={{ borderLeftColor: '#22c55e', height: '100%' }}>
                      <div className="modal-skill-card__icon" style={{ color: '#22c55e' }}>📖</div>
                      <div className="modal-skill-card__info">
                        <h4 className="modal-skill-card__name">Reading Section (RC)</h4>
                        <span className="modal-skill-card__meta">⏱️ 75 phút • 📝 100 câu (Part 5-7)</span>
                      </div>
                      <div className="modal-skill-card__arrow">→</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveSkillModal(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
