"use client"
import { useMemo, useState, useEffect, useRef, Suspense } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import './tests.css'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const SKILL_ICONS: Record<string, { emoji: string; label: string; duration: string; questions: string; color: string }> = {
  listening: { emoji: '🎧', label: 'Listening', duration: '30 mins', questions: '40 Qs', color: '#3b82f6' },
  reading: { emoji: '📖', label: 'Reading', duration: '60 mins', questions: '40 Qs', color: '#22c55e' },
  writing: { emoji: '✍️', label: 'Writing', duration: '60 mins', questions: '2 Tasks', color: '#f59e0b' },
  speaking: { emoji: '🎙️', label: 'Speaking', duration: '11-14 mins', questions: '3 Parts', color: '#8b5cf6' },
}

function TestsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')

  const { data, error, isLoading } = useSWR('/api/tests', fetcher)

  // Navigation states (used for standard view navigation hierarchy)
  const [selectedExam, setSelectedExam] = useState<'ielts' | 'toeic' | null>(null)
  const [selectedBook, setSelectedBook] = useState<number | null>(null)
  const [selectedToeicYear, setSelectedToeicYear] = useState<'2024' | '2026' | null>(null)

  // Filter states
  const [tempType, setTempType] = useState<'all' | 'ielts' | 'toeic'>('all')
  const [tempSkills, setTempSkills] = useState({
    listening: false,
    reading: false,
    writing: false,
    speaking: false,
  })

  // Applied filter states
  const [appliedType, setAppliedType] = useState<'all' | 'ielts' | 'toeic'>('all')
  const [appliedSkills, setAppliedSkills] = useState({
    listening: false,
    reading: false,
    writing: false,
    speaking: false,
  })
  const [isFiltered, setIsFiltered] = useState(false)

  // Modal selection popup state
  const [activeSkillModal, setActiveSkillModal] = useState<{
    bookOrYear: string | number
    testNum: number
    examType: 'ielts' | 'toeic'
  } | null>(null)

  const isApplyingFiltersRef = useRef(false)

  // Synchronize sidebar search parameters with component state
  useEffect(() => {
    if (isApplyingFiltersRef.current) {
      isApplyingFiltersRef.current = false
      // Still synchronize selectedExam context to match the new URL parameters
      if (typeParam === 'ielts') {
        setSelectedExam('ielts')
        setSelectedBook(null)
        setSelectedToeicYear(null)
      } else if (typeParam === 'toeic') {
        setSelectedExam('toeic')
        setSelectedBook(null)
        setSelectedToeicYear(null)
      } else {
        setSelectedExam(null)
        setSelectedBook(null)
        setSelectedToeicYear(null)
      }
      return
    }

    if (typeParam === 'ielts') {
      setSelectedExam('ielts')
      setSelectedBook(null)
      setSelectedToeicYear(null)
      setIsFiltered(false)
      setTempType('ielts')
      setAppliedType('ielts')
    } else if (typeParam === 'toeic') {
      setSelectedExam('toeic')
      setSelectedBook(null)
      setSelectedToeicYear(null)
      setIsFiltered(false)
      setTempType('toeic')
      setAppliedType('toeic')
    } else {
      setSelectedExam(null)
      setSelectedBook(null)
      setSelectedToeicYear(null)
      setIsFiltered(false)
      setTempType('all')
      setAppliedType('all')
    }
  }, [typeParam])

  // Group tests by book
  const testsByBook = useMemo(() => {
    if (!data || !Array.isArray(data)) return {}
    const grouped: Record<number, any[]> = {}
    data.forEach((t: any) => {
      const b = t.book ?? 11
      if (!grouped[b]) grouped[b] = []
      grouped[b].push(t)
    })
    Object.keys(grouped).forEach((b: any) => {
      grouped[b].sort((a: any, b: any) => a.test_number - b.test_number)
    })
    return grouped
  }, [data])

  const sortedBooks = useMemo(() => {
    return Object.keys(testsByBook).map(Number).sort((a, b) => b - a)
  }, [testsByBook])

  // Apply filters handler
  const handleApplyFilters = () => {
    isApplyingFiltersRef.current = true
    setAppliedType(tempType)
    setAppliedSkills({ ...tempSkills })
    setIsFiltered(true)

    // Update URL query parameters based on tempType to match sidebar selection state
    const params = new URLSearchParams(searchParams.toString())
    if (tempType === 'all') {
      params.delete('type')
    } else {
      params.set('type', tempType)
    }
    router.push(`/tests?${params.toString()}`)
  }

  // Clear filters handler
  const handleClearFilters = () => {
    setTempType(typeParam === 'ielts' ? 'ielts' : typeParam === 'toeic' ? 'toeic' : 'all')
    setTempSkills({
      listening: false,
      reading: false,
      writing: false,
      speaking: false,
    })
    setAppliedType(typeParam === 'ielts' ? 'ielts' : typeParam === 'toeic' ? 'toeic' : 'all')
    setAppliedSkills({
      listening: false,
      reading: false,
      writing: false,
      speaking: false,
    })
    setIsFiltered(false)
  }

  // Compute filtered test list
  const filteredIndividualTests = useMemo(() => {
    const list: any[] = []
    const anySkillSelected = Object.values(appliedSkills).some(val => val)

    // 1. IELTS tests (from backend database)
    if (appliedType !== 'toeic' && data && Array.isArray(data)) {
      data.forEach((t: any) => {
        const isIeltsTest = t.book !== 2024 && t.book !== 2026
        if (!isIeltsTest) return

        const skillsToAdd = ['listening', 'reading', 'writing', 'speaking']
        skillsToAdd.forEach(s => {
          if (!anySkillSelected || appliedSkills[s as keyof typeof appliedSkills]) {
            list.push({
              id: `ielts-${t.book}-${t.test_number}-${s}`,
              type: 'ielts',
              book: t.book,
              testNum: t.test_number,
              skill: s,
              label: `Cambridge IELTS ${t.book}`,
              title: `Test ${t.test_number}`,
              link: `/tests/${t.book}/${t.test_number}/practice/${s}`
            })
          }
        })
      })
    }

    // 2. ETS TOEIC tests (generated locally)
    if (appliedType !== 'ielts') {
      const etsYears = [2024, 2026]
      etsYears.forEach(year => {
        for (let testNum = 1; testNum <= 10; testNum++) {
          if (!anySkillSelected || appliedSkills.listening) {
            list.push({
              id: `ets-${year}-${testNum}-lc`,
              type: 'toeic',
              book: year,
              testNum: testNum,
              skill: 'listening',
              label: `ETS TOEIC ${year}`,
              title: `Practice Test ${testNum}`,
              link: `/tests/ets/${year}/lc/${testNum}`
            })
          }
          if (!anySkillSelected || appliedSkills.reading) {
            list.push({
              id: `ets-${year}-${testNum}-rc`,
              type: 'toeic',
              book: year,
              testNum: testNum,
              skill: 'reading',
              label: `ETS TOEIC ${year}`,
              title: `Practice Test ${testNum}`,
              link: `/tests/ets/${year}/rc/${testNum}`
            })
          }
        }
      })
    }

    // Sort: newer books/years first, then test number
    return list.sort((a, b) => {
      if (b.book !== a.book) return b.book - a.book
      if (a.testNum !== b.testNum) return a.testNum - b.testNum
      return a.skill.localeCompare(b.skill)
    })
  }, [data, appliedType, appliedSkills])

  return (
    <div className="tests-layout-container">
      {/* 1. Left Side: Filter Panel */}
      <aside className="tests-filter-panel">
        <h3 className="filter-panel-title">⚙️ Filters</h3>
        
        {/* Test Type filter */}
        <div className="filter-group">
          <label className="filter-group-label">Test Type</label>
          <div className="filter-radio-list">
            <label className="filter-radio-item">
              <input 
                type="radio" 
                name="test-type" 
                value="all" 
                checked={tempType === 'all'} 
                onChange={() => setTempType('all')} 
              />
              <span>All Exams</span>
            </label>
            <label className="filter-radio-item">
              <input 
                type="radio" 
                name="test-type" 
                value="ielts" 
                checked={tempType === 'ielts'} 
                onChange={() => setTempType('ielts')}
              />
              <span>Cambridge IELTS</span>
            </label>
            <label className="filter-radio-item">
              <input 
                type="radio" 
                name="test-type" 
                value="toeic" 
                checked={tempType === 'toeic'} 
                onChange={() => {
                  setTempType('toeic')
                  // Automatically clear Writing and Speaking filters when switching to TOEIC
                  setTempSkills(prev => ({ ...prev, writing: false, speaking: false }))
                }}
              />
              <span>ETS TOEIC</span>
            </label>
          </div>
        </div>

        {/* Skills filter */}
        <div className="filter-group">
          <label className="filter-group-label">Skills</label>
          <div className="filter-checkbox-list">
            <label className="filter-checkbox-item">
              <input 
                type="checkbox" 
                checked={tempSkills.listening} 
                onChange={(e) => setTempSkills({ ...tempSkills, listening: e.target.checked })}
              />
              <span>🎧 Listening</span>
            </label>
            <label className="filter-checkbox-item">
              <input 
                type="checkbox" 
                checked={tempSkills.reading} 
                onChange={(e) => setTempSkills({ ...tempSkills, reading: e.target.checked })}
              />
              <span>📖 Reading</span>
            </label>
            {tempType !== 'toeic' && (
              <>
                <label className="filter-checkbox-item">
                  <input 
                    type="checkbox" 
                    checked={tempSkills.writing} 
                    onChange={(e) => setTempSkills({ ...tempSkills, writing: e.target.checked })}
                  />
                  <span>✍️ Writing</span>
                </label>
                <label className="filter-checkbox-item">
                  <input 
                    type="checkbox" 
                    checked={tempSkills.speaking} 
                    onChange={(e) => setTempSkills({ ...tempSkills, speaking: e.target.checked })}
                  />
                  <span>🎙️ Speaking</span>
                </label>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="filter-actions">
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleApplyFilters}>
            Apply Filters
          </button>
          {isFiltered && (
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '8px' }} onClick={handleClearFilters}>
              Reset Filters
            </button>
          )}
        </div>
      </aside>

      {/* 2. Right Side: Tests Content Grid */}
      <div className="tests-content-area">
        {error && (
          <div className="home-error">
            ⚠️ Failed to load test library. Please ensure the backend server is running.
          </div>
        )}

        {/* CASE A: Filter Mode Active */}
        {isFiltered ? (
          <div className="fade-in">
            <div className="section-header">
              <h2 className="section-title">🔍 Filtered Results ({filteredIndividualTests.length})</h2>
              <button className="btn-clear-badge" onClick={handleClearFilters}>Clear Filters ×</button>
            </div>

            {isLoading && (
              <div className="book-grid">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="skeleton" style={{ height: '140px', borderRadius: 'var(--radius-lg)' }} />
                ))}
              </div>
            )}

            {!isLoading && filteredIndividualTests.length === 0 ? (
              <div className="no-filtered-results">
                <span>📂 No matching tests found. Try adjusting your filter checkboxes.</span>
              </div>
            ) : (
              <div className="book-grid" style={{ paddingLeft: 0, paddingRight: 0 }}>
                {filteredIndividualTests.map((t: any) => {
                  const info = t.type === 'ielts' 
                    ? SKILL_ICONS[t.skill] 
                    : { emoji: t.skill === 'listening' ? '🎧' : '📖', label: t.skill === 'listening' ? 'Listening (LC)' : 'Reading (RC)', color: t.skill === 'listening' ? '#3b82f6' : '#22c55e' }
                  
                  return (
                    <Link key={t.id} href={t.link} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="test-card clickable-test-card" style={{ borderLeft: `5px solid ${info.color}` }}>
                        <div className="test-card__header">
                          <div className="test-card__book">{t.label}</div>
                          <div className="test-card__title">{t.title}</div>
                        </div>
                        <div className="test-card__body">
                          <div className="direct-skill-badge" style={{ background: `${info.color}15`, color: info.color }}>
                            {info.emoji} {info.label}
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* CASE B: Standard View Hierarchy (No active filter) */
          <div className="fade-in">
            {/* Level 1: Choice page */}
            {selectedExam === null && (
              <div className="exam-choices-wrapper">
                <h2 className="choice-title">Select Practice Exam</h2>
                <p className="choice-subtitle">Select one of the exams below to browse books, editions and available practice tests.</p>
                <div className="exam-choices" style={{ maxWidth: '800px' }}>
                  <div className="exam-card exam-card--ielts" onClick={() => router.push('/tests?type=ielts')}>
                    <div className="exam-card__glow" />
                    <div className="exam-card__icon">🎯</div>
                    <h3 className="exam-card__title">Cambridge IELTS</h3>
                    <p className="exam-card__desc">
                      Practice official Cambridge IELTS books 11 to 19. All skills (Listening, Reading, Writing, Speaking) supported.
                    </p>
                    <button className="btn btn-primary exam-card__btn">Practice IELTS</button>
                  </div>

                  <div className="exam-card exam-card--toeic" onClick={() => router.push('/tests?type=toeic')}>
                    <div className="exam-card__glow" />
                    <div className="exam-card__icon">⏱️</div>
                    <h3 className="exam-card__title">ETS TOEIC</h3>
                    <p className="exam-card__desc">
                      Practice Listening (LC) and Reading (RC) sections from recent official ETS TOEIC test series.
                    </p>
                    <button className="btn btn-primary exam-card__btn exam-card__btn--toeic">Practice TOEIC</button>
                  </div>
                </div>
              </div>
            )}

            {/* Level 2: Cambridge Books list (IELTS) */}
            {selectedExam === 'ielts' && selectedBook === null && (
              <div className="book-selection-wrapper">
                <h2 className="choice-title">Select Cambridge IELTS Book</h2>
                <p className="choice-subtitle">Select a book package to view individual test practices.</p>
                
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
            )}

            {/* Level 2: ETS Editions list (TOEIC) */}
            {selectedExam === 'toeic' && selectedToeicYear === null && (
              <div className="book-selection-wrapper">
                <h2 className="choice-title">Select ETS TOEIC Edition</h2>
                <p className="choice-subtitle">Select an edition based on the release year to browse tests.</p>
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
            )}

            {/* Level 3: IELTS tests list for book */}
            {selectedExam === 'ielts' && selectedBook !== null && (
              <div className="fade-in">
                <div className="subpage-header" style={{ marginBottom: '24px' }}>
                  <button className="btn-back" onClick={() => setSelectedBook(null)}>
                    ← Back to Books
                  </button>
                  <div className="nav-breadcrumb-indicator">
                    Cambridge IELTS › Cam {selectedBook}
                  </div>
                </div>

                <div className="home-book-header" style={{ marginBottom: '24px' }}>
                  <h2 className="home-book-title">Cambridge IELTS {selectedBook}</h2>
                  <p className="home-book-subtitle">Academic • Select a test below to start practicing</p>
                </div>

                <div className="book-grid" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  {(testsByBook[selectedBook] ?? []).map((t: any) => (
                    <div
                      key={t.test_number}
                      className="test-card slide-up clickable-test-card"
                      onClick={() => setActiveSkillModal({ bookOrYear: selectedBook, testNum: t.test_number, examType: 'ielts' })}
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
                            Choose Skill
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Level 3: ETS tests list for edition */}
            {selectedExam === 'toeic' && selectedToeicYear !== null && (
              <div className="fade-in">
                <div className="subpage-header" style={{ marginBottom: '24px' }}>
                  <button className="btn-back" onClick={() => setSelectedToeicYear(null)}>
                    ← Back to Editions
                  </button>
                  <div className="nav-breadcrumb-indicator">
                    ETS TOEIC › ETS {selectedToeicYear}
                  </div>
                </div>

                <div className="home-book-header" style={{ borderLeftColor: selectedToeicYear === '2024' ? '#3b82f6' : 'var(--status-correct, #22c55e)', marginBottom: '24px' }}>
                  <h2 className="home-book-title">ETS TOEIC {selectedToeicYear}</h2>
                  <p className="home-book-subtitle">Select a test to choose Listening (LC) or Reading (RC) sections</p>
                </div>

                <div className="book-grid" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((testNum) => (
                    <div 
                      key={testNum} 
                      className="test-card slide-up clickable-test-card" 
                      onClick={() => setActiveSkillModal({ bookOrYear: selectedToeicYear, testNum: testNum, examType: 'toeic' })}
                    >
                      <div className="test-card__header">
                        <div className="test-card__book">ETS TOEIC {selectedToeicYear}</div>
                        <div className="test-card__title">Test {testNum}</div>
                      </div>
                      <div className="test-card__body">
                        <div className="test-card__skills-preview" style={{ justifyContent: 'center', gap: '16px', fontSize: '1.2rem' }}>
                          <span>🎧 Listening</span>
                          <span>📖 Reading</span>
                        </div>
                        <div className="test-card__actions" style={{ marginTop: '16px' }}>
                          <button className="btn btn-secondary btn-sm" style={{ width: '100%', background: selectedToeicYear === '2024' ? '#3b82f6' : 'var(--status-correct, #22c55e)', borderColor: selectedToeicYear === '2024' ? '#3b82f6' : 'var(--status-correct, #22c55e)', color: 'white' }}>
                            Start Test Section
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
      </div>

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
                    ? `Test ${activeSkillModal.testNum} • Select skill to start practicing`
                    : `Test ${activeSkillModal.testNum} • Select test section to start practicing`}
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
                        <span className="modal-skill-card__meta">⏱️ 45 mins • 📝 100 Qs (Part 1-4)</span>
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
                        <span className="modal-skill-card__meta">⏱️ 75 mins • 📝 100 Qs (Part 5-7)</span>
                      </div>
                      <div className="modal-skill-card__arrow">→</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveSkillModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TestsPage() {
  return (
    <Suspense fallback={<div className="no-filtered-results">Loading practice tests...</div>}>
      <TestsContent />
    </Suspense>
  )
}
