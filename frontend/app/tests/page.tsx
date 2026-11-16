"use client"
import { useMemo, useState, useEffect, useRef, Suspense } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { Alert, Breadcrumb, Button, Checkbox, Empty, Form, Modal, Radio, Skeleton, Space } from 'antd'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import TuneRounded from '@mui/icons-material/TuneRounded'
import './tests.css'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type ExamType = 'all' | 'ielts' | 'toeic'
type SkillFlags = { listening: boolean; reading: boolean; writing: boolean; speaking: boolean }
type FilterValues = { type: ExamType; skills: SkillFlags; sortOrder: 'desc' | 'asc' }

const NO_SKILLS: SkillFlags = { listening: false, reading: false, writing: false, speaking: false }
const typeFromParam = (p: string | null): ExamType => (p === 'ielts' || p === 'toeic' ? p : 'all')

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

  const { data: ieltsData, error: ieltsError, isLoading: ieltsLoading } = useSWR('/api/tests', fetcher)
  const { data: toeicData, error: toeicError, isLoading: toeicLoading } = useSWR('/api/tests/toeic', fetcher)

  // Navigation states (used for standard view navigation hierarchy)
  const [selectedExam, setSelectedExam] = useState<'ielts' | 'toeic' | null>(null)
  const [selectedBook, setSelectedBook] = useState<number | null>(null)
  const [selectedToeicYear, setSelectedToeicYear] = useState<'2024' | '2026' | null>(null)

  // Draft filter values live in react-hook-form until "Apply Filters"
  const { control, handleSubmit, reset, setValue, watch } = useForm<FilterValues>({
    defaultValues: { type: 'all', skills: { ...NO_SKILLS }, sortOrder: 'desc' },
  })
  const tempType = watch('type')

  // Applied filter states
  const [appliedType, setAppliedType] = useState<'all' | 'ielts' | 'toeic'>('all')
  const [appliedSkills, setAppliedSkills] = useState({
    listening: false,
    reading: false,
    writing: false,
    speaking: false,
  })
  const [appliedSortOrder, setAppliedSortOrder] = useState<'desc' | 'asc'>('desc')
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
      setValue('type', 'ielts')
      setAppliedType('ielts')
    } else if (typeParam === 'toeic') {
      setSelectedExam('toeic')
      setSelectedBook(null)
      setSelectedToeicYear(null)
      setIsFiltered(false)
      setValue('type', 'toeic')
      setAppliedType('toeic')
    } else {
      setSelectedExam(null)
      setSelectedBook(null)
      setSelectedToeicYear(null)
      setIsFiltered(false)
      setValue('type', 'all')
      setAppliedType('all')
    }
  }, [typeParam, setValue])

  // Group tests by book
  const testsByBook = useMemo(() => {
    if (!ieltsData || !Array.isArray(ieltsData)) return {}
    const grouped: Record<number, any[]> = {}
    ieltsData.forEach((t: any) => {
      const b = t.book ?? 11
      if (!grouped[b]) grouped[b] = []
      grouped[b].push(t)
    })
    Object.keys(grouped).forEach((b: any) => {
      grouped[b].sort((a: any, b: any) => a.test_number - b.test_number)
    })
    return grouped
  }, [ieltsData])

  const sortedBooks = useMemo(() => {
    const booksInDb = Object.keys(testsByBook).map(Number)
    if (booksInDb.length > 0) {
      return booksInDb.sort((a, b) => b - a)
    }
    return [19, 18, 17, 16, 15, 14, 13, 12, 11]
  }, [testsByBook])

  // Group TOEIC tests by year
  const toeicTestsByYear = useMemo(() => {
    if (!toeicData || !Array.isArray(toeicData)) return {}
    const grouped: Record<number, any[]> = {}
    toeicData.forEach((t: any) => {
      const b = t.book
      if (!grouped[b]) grouped[b] = []
      grouped[b].push(t)
    })
    Object.keys(grouped).forEach((b: any) => {
      grouped[b].sort((a: any, b: any) => a.test_number - b.test_number)
    })
    return grouped
  }, [toeicData])

  const sortedToeicYears = useMemo(() => {
    const yearsInDb = Object.keys(toeicTestsByYear).map(Number)
    if (yearsInDb.length > 0) {
      return yearsInDb.sort((a, b) => b - a)
    }
    return [2026, 2024]
  }, [toeicTestsByYear])

  // Apply filters handler
  const handleApplyFilters = handleSubmit(({ type, skills, sortOrder }) => {
    isApplyingFiltersRef.current = true
    setAppliedType(type)
    setAppliedSkills({ ...skills })
    setAppliedSortOrder(sortOrder)
    setIsFiltered(true)

    // Update URL query parameters based on the chosen type to match sidebar selection state
    const params = new URLSearchParams(searchParams.toString())
    if (type === 'all') {
      params.delete('type')
    } else {
      params.set('type', type)
    }
    router.push(`/tests?${params.toString()}`)
  })

  // Clear filters handler
  const handleClearFilters = () => {
    const type = typeFromParam(typeParam)
    reset({ type, skills: { ...NO_SKILLS }, sortOrder: 'desc' })
    setAppliedType(type)
    setAppliedSkills({ ...NO_SKILLS })
    setAppliedSortOrder('desc')
    setIsFiltered(false)
  }

  // Compute filtered test list
  const filteredIndividualTests = useMemo(() => {
    const list: any[] = []
    const anySkillSelected = Object.values(appliedSkills).some(val => val)

    // 1. IELTS tests (from backend database or fallback)
    if (appliedType !== 'toeic') {
      const dbIelts = (ieltsData && Array.isArray(ieltsData))
        ? ieltsData
        : []
      
      const ieltsTestsList = dbIelts.length > 0
        ? dbIelts
        : [19, 18, 17, 16, 15, 14, 13, 12, 11].flatMap(book =>
            Array.from({ length: 4 }, (_, idx) => ({ book, test_number: idx + 1 }))
          )

      ieltsTestsList.forEach((t: any) => {
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

    // 2. ETS TOEIC tests (from backend database or fallback)
    if (appliedType !== 'ielts') {
      const dbToeic = (toeicData && Array.isArray(toeicData))
        ? toeicData
        : []
      
      const toeicTestsList = dbToeic.length > 0
        ? dbToeic
        : [2026, 2024].flatMap(year =>
            Array.from({ length: 10 }, (_, idx) => ({ book: year, test_number: idx + 1 }))
          )

      toeicTestsList.forEach((t: any) => {
        const year = t.book
        const testNum = t.test_number
        if (!anySkillSelected || appliedSkills.listening) {
          list.push({
            id: `ets-${year}-${testNum}-lc`,
            type: 'toeic',
            book: year,
            testNum: testNum,
            skill: 'listening',
            label: `TOEIC ${year}`,
            title: `Practice Test ${testNum}`,
            link: `/tests/toeic/${year}/lc/${testNum}`
          })
        }
        if (!anySkillSelected || appliedSkills.reading) {
          list.push({
            id: `ets-${year}-${testNum}-rc`,
            type: 'toeic',
            book: year,
            testNum: testNum,
            skill: 'reading',
            label: `TOEIC ${year}`,
            title: `Practice Test ${testNum}`,
            link: `/tests/toeic/${year}/rc/${testNum}`
          })
        }
      })
    }

    // Sort with priority: IELTS first when "All Exams", then by book/year, then test number
    return list.sort((a, b) => {
      // When showing all exams, always group IELTS before TOEIC
      if (appliedType === 'all' && a.type !== b.type) {
        return a.type === 'ielts' ? -1 : 1
      }
      // Within same type, sort by book/year number
      if (a.book !== b.book) {
        return appliedSortOrder === 'desc' ? b.book - a.book : a.book - b.book
      }
      // Same book, sort by test number (always ascending)
      if (a.testNum !== b.testNum) return a.testNum - b.testNum
      return a.skill.localeCompare(b.skill)
    })
  }, [ieltsData, toeicData, appliedType, appliedSkills, appliedSortOrder])

  return (
    <div className="tests-layout-container">
      {/* 1. Left Side: Filter Panel */}
      <aside className="tests-filter-panel">
        <h3 className="filter-panel-title"><TuneRounded fontSize="small" /> Filters</h3>

        <Form layout="vertical" component="form" onFinish={() => handleApplyFilters()}>
          {/* Test Type filter */}
          <Form.Item label="Test Type" className="filter-group">
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Radio.Group
                  className="filter-radio-list"
                  value={field.value}
                  onChange={e => {
                    field.onChange(e.target.value)
                    // Automatically clear Writing and Speaking filters when switching to TOEIC
                    if (e.target.value === 'toeic') {
                      setValue('skills.writing', false)
                      setValue('skills.speaking', false)
                    }
                  }}
                >
                  <Space direction="vertical">
                    <Radio value="all">All Exams</Radio>
                    <Radio value="ielts">Cambridge IELTS</Radio>
                    <Radio value="toeic">ETS TOEIC</Radio>
                  </Space>
                </Radio.Group>
              )}
            />
          </Form.Item>

          {/* Skills filter */}
          <Form.Item label="Skills" className="filter-group">
            <Space direction="vertical" className="filter-checkbox-list">
              {(['listening', 'reading', 'writing', 'speaking'] as const)
                .filter(skill => tempType !== 'toeic' || skill === 'listening' || skill === 'reading')
                .map(skill => (
                  <Controller
                    key={skill}
                    control={control}
                    name={`skills.${skill}`}
                    render={({ field }) => (
                      <Checkbox checked={field.value} onChange={e => field.onChange(e.target.checked)}>
                        {SKILL_ICONS[skill].emoji} {SKILL_ICONS[skill].label}
                      </Checkbox>
                    )}
                  />
                ))}
            </Space>
          </Form.Item>

          {/* Sort Order filter */}
          <Form.Item label="Sort Order" className="filter-group">
            <Controller
              control={control}
              name="sortOrder"
              render={({ field }) => (
                <Radio.Group className="filter-radio-list" value={field.value} onChange={e => field.onChange(e.target.value)}>
                  <Space direction="vertical">
                    <Radio value="desc">High → Low (19, 18, …11)</Radio>
                    <Radio value="asc">Low → High (11, 12, …19)</Radio>
                  </Space>
                </Radio.Group>
              )}
            />
          </Form.Item>

          {/* Actions */}
          <div className="filter-actions">
            <Button type="primary" htmlType="submit" block>
              Apply Filters
            </Button>
            {isFiltered && (
              <Button block style={{ marginTop: 8 }} onClick={handleClearFilters}>
                Reset Filters
              </Button>
            )}
          </div>
        </Form>
      </aside>

            {/* 2. Right Side: Tests Content Grid */}
      <div className="tests-content-area">
        {(ieltsError || toeicError) && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
            message="Failed to load test library. Please ensure the backend server is running."
          />
        )}

        {/* CASE A: Filter Mode Active */}
        {isFiltered ? (
          <div className="fade-in">
            <div className="section-header">
              <h2 className="section-title">🔍 Filtered Results ({filteredIndividualTests.length})</h2>
              <Button size="small" danger onClick={handleClearFilters}>Clear Filters ×</Button>
            </div>

            {(ieltsLoading || toeicLoading) && (
              <div className="book-grid">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton.Node key={i} active className="tests-skeleton-card" />
                ))}
              </div>
            )}

            {!(ieltsLoading || toeicLoading) && filteredIndividualTests.length === 0 ? (
              <Empty className="no-filtered-results" description="No matching tests found. Try adjusting your filter checkboxes." />
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
                    <Button type="primary" size="large" className="exam-card__btn">Practice IELTS</Button>
                  </div>

                  <div className="exam-card exam-card--toeic" onClick={() => router.push('/tests?type=toeic')}>
                    <div className="exam-card__glow" />
                    <div className="exam-card__icon">⏱️</div>
                    <h3 className="exam-card__title">ETS TOEIC</h3>
                    <p className="exam-card__desc">
                      Practice Listening (LC) and Reading (RC) sections from recent official ETS TOEIC test series.
                    </p>
                    <Button type="primary" size="large" className="exam-card__btn exam-card__btn--toeic">Practice TOEIC</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Level 2: Cambridge Books list (IELTS) */}
            {selectedExam === 'ielts' && selectedBook === null && (
              <div className="book-selection-wrapper">
                <h2 className="choice-title">Select Cambridge IELTS Book</h2>
                <p className="choice-subtitle">Select a book package to view individual test practices.</p>
                
                {ieltsLoading && (
                  <div className="book-choices-grid">
                    {[19, 18, 17, 16, 15, 14, 13, 12, 11].map(i => (
                      <Skeleton.Node key={i} active className="tests-skeleton-card" />
                    ))}
                  </div>
                )}

                {ieltsData && (
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
                
                {toeicLoading && (
                  <div className="book-choices-grid book-choices-grid--toeic">
                    {[2026, 2024].map(year => (
                      <Skeleton.Node key={year} active className="tests-skeleton-card" />
                    ))}
                  </div>
                )}
                
                {!toeicLoading && (
                  <div className="book-choices-grid book-choices-grid--toeic">
                    {sortedToeicYears.map((year) => (
                      <div 
                        key={year}
                        className="book-choice-card book-choice-card--toeic"
                        onClick={() => setSelectedToeicYear(String(year) as any)}
                      >
                        {year === 2026 && <div className="book-choice-card__badge">Hot</div>}
                        <div className="book-choice-card__icon">📘</div>
                        <h3 className="book-choice-card__title">ETS {year}</h3>
                        <p className="book-choice-card__subtitle">{toeicTestsByYear[year]?.length ?? 10} Tests (LC & RC)</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Level 3: IELTS tests list for book */}
            {selectedExam === 'ielts' && selectedBook !== null && (
              <div className="fade-in">
                <div className="subpage-header" style={{ marginBottom: '24px' }}>
                  <Button icon={<ArrowBackRounded fontSize="small" />} onClick={() => setSelectedBook(null)}>
                    Back to Books
                  </Button>
                  <Breadcrumb
                    className="nav-breadcrumb-indicator"
                    items={[{ title: 'Cambridge IELTS' }, { title: `Cam ${selectedBook}` }]}
                  />
                </div>

                <div className="home-book-header" style={{ marginBottom: '24px' }}>
                  <h2 className="home-book-title">Cambridge IELTS {selectedBook}</h2>
                  <p className="home-book-subtitle">Academic • Select a test below to start practicing</p>
                </div>

                <div className="book-grid" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  {(testsByBook[selectedBook] && testsByBook[selectedBook].length > 0
                    ? testsByBook[selectedBook]
                    : Array.from({ length: 4 }, (_, idx) => ({ test_number: idx + 1 }))
                  ).map((t: any) => (
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
                          <Button type="primary" block>
                            Choose Skill
                          </Button>
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
                  <Button icon={<ArrowBackRounded fontSize="small" />} onClick={() => setSelectedToeicYear(null)}>
                    Back to Editions
                  </Button>
                  <Breadcrumb
                    className="nav-breadcrumb-indicator"
                    items={[{ title: 'ETS TOEIC' }, { title: `ETS ${selectedToeicYear}` }]}
                  />
                </div>

                <div className="home-book-header" style={{ borderLeftColor: selectedToeicYear === '2024' ? '#3b82f6' : 'var(--status-correct, #22c55e)', marginBottom: '24px' }}>
                  <h2 className="home-book-title">ETS TOEIC {selectedToeicYear}</h2>
                  <p className="home-book-subtitle">Select a test to choose Listening (LC) or Reading (RC) sections</p>
                </div>

                <div className="book-grid" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  {(toeicTestsByYear[Number(selectedToeicYear)] && toeicTestsByYear[Number(selectedToeicYear)].length > 0
                    ? toeicTestsByYear[Number(selectedToeicYear)]
                    : Array.from({ length: 10 }, (_, idx) => ({ test_number: idx + 1 }))
                  ).map((t: any) => (
                    <div 
                      key={t.test_number} 
                      className="test-card slide-up clickable-test-card" 
                      onClick={() => setActiveSkillModal({ bookOrYear: selectedToeicYear, testNum: t.test_number, examType: 'toeic' })}
                    >
                      <div className="test-card__header">
                        <div className="test-card__book">ETS TOEIC {selectedToeicYear}</div>
                        <div className="test-card__title">Test {t.test_number}</div>
                      </div>
                      <div className="test-card__body">
                        <div className="test-card__skills-preview" style={{ justifyContent: 'center', gap: '16px', fontSize: '1.2rem' }}>
                          <span>🎧 Listening</span>
                          <span>📖 Reading</span>
                        </div>
                        <div className="test-card__actions" style={{ marginTop: '16px' }}>
                          <Button
                            type="primary"
                            block
                            style={{ background: selectedToeicYear === '2024' ? '#3b82f6' : 'var(--status-correct, #22c55e)' }}
                          >
                            Start Test Section
                          </Button>
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
      <Modal
        open={activeSkillModal !== null}
        onCancel={() => setActiveSkillModal(null)}
        centered
        width={640}
        className="skill-select-modal"
        footer={<Button onClick={() => setActiveSkillModal(null)}>Close</Button>}
        title={activeSkillModal && (
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
        )}
      >
        {activeSkillModal && (
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
                    href={`/tests/toeic/${activeSkillModal.bookOrYear}/lc/${activeSkillModal.testNum}`}
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
                    href={`/tests/toeic/${activeSkillModal.bookOrYear}/rc/${activeSkillModal.testNum}`}
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
        )}
      </Modal>
    </div>
  )
}

export default function TestsPage() {
  return (
    <Suspense fallback={<Skeleton active style={{ padding: 24 }} />}>
      <TestsContent />
    </Suspense>
  )
}
