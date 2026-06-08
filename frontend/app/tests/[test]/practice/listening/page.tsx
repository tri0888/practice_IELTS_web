"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const BACKEND = '/api'
const DURATION_SECONDS = 30 * 60 // 30 minutes

const STATIC_PRACTICE_LAYOUT = {
  listening: [
    { section: 1, pages: [11, 12] },
    { section: 2, pages: [13, 14] },
    { section: 3, pages: [15, 16] },
    { section: 4, pages: [17, 18] },
  ],
  reading: [
    {
      passage: 1,
      pages: [19, 20, 21],
      groups: [
        { range: '1-7', title: 'Questions 1-7' },
        { range: '8-13', title: 'Questions 8-13' },
      ],
    },
    {
      passage: 2,
      pages: [22, 23, 24, 25],
      groups: [
        { range: '14-19', title: 'Questions 14-19' },
        { range: '20-26', title: 'Questions 20-26' },
      ],
    },
    {
      passage: 3,
      pages: [26, 27, 28, 29, 30],
      groups: [
        { range: '27-29', title: 'Questions 27-29' },
        { range: '30-36', title: 'Questions 30-36' },
        { range: '37-40', title: 'Questions 37-40' },
      ],
    },
  ],
}

type Section = {
  section_number: number
  question_range: string
  instruction: string
  content_text: string
  audio_file: string
}

type ContentData = {
  listening: {
    total_questions: number
    duration_minutes: number
    sections: Section[]
  }
}

export default function ListeningPracticePage() {
  const params = useParams<{ test: string }>()
  const router = useRouter()
  const test = params?.test ?? '1'

  const [content, setContent] = useState<ContentData | null>(null)
  const [practiceLayout, setPracticeLayout] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [answerKey, setAnswerKey] = useState<Record<string, { answer: string; explanation: string }> | null>(null)
  const [showResult, setShowResult] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load content
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const resp = await fetch(`${BACKEND}/tests/11/${test}/content`)
        if (!resp.ok) throw new Error('Failed to load')
        const data = await resp.json()
        if (!cancelled) {
          setContent(data)
          // Init answers for questions 1-40
          const init: Record<number, string> = {}
          for (let i = 1; i <= 40; i++) init[i] = ''
          setAnswers(init)
        }

        // Load practice layout
        try {
          const practiceResp = await fetch(`${BACKEND}/tests/11/${test}/practice`)
          if (practiceResp.ok) {
            const practiceData = await practiceResp.json()
            if (!cancelled) setPracticeLayout(practiceData)
          } else {
            if (!cancelled) setPracticeLayout(STATIC_PRACTICE_LAYOUT)
          }
        } catch (e) {
          console.error("Failed to load practice layout, using fallback:", e)
          if (!cancelled) setPracticeLayout(STATIC_PRACTICE_LAYOUT)
        }

        // Create attempt
        const attemptResp = await fetch(`${BACKEND}/attempts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book: 11, test: Number(test), skill: 'listening' }),
        })
        const attemptData = await attemptResp.json()
        if (!cancelled) setAttemptId(attemptData.id)
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [test])


  // Timer
  useEffect(() => {
    if (isSubmitted) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isSubmitted])

  // Auto-submit on time up
  useEffect(() => {
    if (timeLeft === 0 && !isSubmitted) handleSubmit()
  }, [timeLeft, isSubmitted])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const timerClass = timeLeft <= 60 ? 'timer timer--danger' : timeLeft <= 300 ? 'timer timer--warning' : 'timer'

  const answeredCount = useMemo(() =>
    Object.values(answers).filter(a => a.trim() !== '').length
  , [answers])

  const activeSectionPages = useMemo(() => {
    if (!content || !content.listening || !content.listening.sections) return []
    const secList = content.listening.sections
    const secNum = secList[activeSection]?.section_number
    if (!secNum) return []
    const layout = practiceLayout?.listening?.find((s: any) => s.section === secNum)
    if (layout && layout.pages) {
      return layout.pages
    }
    // Fallback: section 1: [11, 12], section 2: [13, 14], section 3: [15, 16], section 4: [17, 18]
    const basePage = 11 + (secNum - 1) * 2
    return [basePage, basePage + 1]
  }, [content, activeSection, practiceLayout])

  const handleSubmit = async () => {
    if (!attemptId) return
    setIsSubmitted(true)
    if (timerRef.current) clearInterval(timerRef.current)

    const responses = Object.entries(answers).map(([q, a]) => ({
      question_number: Number(q),
      answer: a,
    }))

    try {
      const [submitResp, answerResp] = await Promise.all([
        fetch(`${BACKEND}/attempts/${attemptId}/submit`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responses }),
        }),
        fetch(`${BACKEND}/tests/11/${test}/answers`),
      ])
      const submitData = await submitResp.json()
      setResult(submitData.result)
      setShowResult(true)
      if (answerResp.ok) {
        const answerData = await answerResp.json()
        setAnswerKey(answerData.answers)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const getQuestionRange = (range: string): number[] => {
    const [start, end] = range.split('-').map(Number)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  const checkAnswer = (q: number) => {
    if (!answerKey || !answerKey[String(q)]) return false
    const userAns = (answers[q] ?? '').trim().toLowerCase()
    const correctAns = (answerKey[String(q)].answer ?? '').trim().toLowerCase()
    if (userAns === correctAns) return true
    const parts = (answerKey[String(q)].answer ?? '').split(/\s*[-–—]\s*/)
    const firstWord = parts[0]?.trim().toLowerCase() ?? ''
    return userAns === firstWord
  }

  const getDisplayAnswer = (q: number) => {
    if (!answerKey || !answerKey[String(q)]) return ''
    const ans = answerKey[String(q)].answer
    const parts = ans.split(/\s*[-–—]\s*/)
    if (parts.length > 1 && parts[0].length < 10) {
      return parts[0].trim()
    }
    return ans
  }

  const estimateListeningBand = (correct: number): string => {
    if (correct >= 39) return '9.0'
    if (correct >= 37) return '8.5'
    if (correct >= 35) return '8.0'
    if (correct >= 32) return '7.5'
    if (correct >= 30) return '7.0'
    if (correct >= 26) return '6.5'
    if (correct >= 23) return '6.0'
    if (correct >= 20) return '5.5'
    if (correct >= 16) return '5.0'
    if (correct >= 13) return '4.5'
    if (correct >= 10) return '4.0'
    if (correct >= 8) return '3.5'
    if (correct >= 6) return '3.0'
    if (correct >= 4) return '2.5'
    return '2.0'
  }

  if (loading) {
    return (
      <div className="container fade-in" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: '2rem', marginBottom: 16 }}>🎧</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Listening Test...</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Đang tải nội dung bài thi</div>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p>❌ Không thể tải nội dung bài thi này.</p>
          <Link href={`/tests/${test}`}>
            <button className="btn btn-primary" style={{ marginTop: 16 }}>Quay lại</button>
          </Link>
        </div>
      </div>
    )
  }

  const sections = content.listening.sections

  return (
    <div className="fade-in">
      {/* Exam Bar */}
      <div className="exam-bar">
        <div className="exam-bar__info">
          <span className="exam-bar__badge">Listening</span>
          <span>Cambridge IELTS 11 — Test {test}</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>
            {answeredCount}/40 đã trả lời
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className={timerClass}>
            ⏱️ {formatTime(timeLeft)}
          </div>
          {!isSubmitted && (
            <button className="btn btn-submit btn-sm" onClick={handleSubmit}>
              Nộp bài
            </button>
          )}
        </div>
      </div>

      <div className="split-view" style={{ gridTemplateColumns: '1.2fr 1px 1fr' }}>
        {/* Left: PDF Questions */}
        <div className="pdf-viewer-container">
          {activeSectionPages.map((pageNumber: number) => (
            <div key={pageNumber} className="pdf-page-card">
              <img
                src={`${BACKEND}/pdf-pages/${pageNumber}.png`}
                alt={`Page ${pageNumber}`}
                className="pdf-page-img"
              />
              <div className="pdf-page-number">Trang {pageNumber}</div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="split-view__divider" />

        {/* Right: Answers & Controls */}
        <div className="split-view__panel" style={{ background: 'var(--bg-primary)', paddingBottom: 80 }}>
          {/* Section Tabs */}
          <div className="section-tabs" style={{ marginBottom: 16 }}>
            {sections.map((section, idx) => (
              <button
                key={section.section_number}
                className={`section-tab ${activeSection === idx ? 'section-tab--active' : ''}`}
                onClick={() => setActiveSection(idx)}
              >
                Section {section.section_number}
              </button>
            ))}
          </div>

          {/* Audio Player */}
          <div className="audio-player" style={{ marginBottom: 16 }}>
            <div className="audio-player__label">
              🎧 Section {sections[activeSection].section_number} Audio
            </div>
            <audio controls preload="none" style={{ width: '100%', height: 40 }} key={activeSection}>
              <source
                src={`${BACKEND}/audio/${encodeURIComponent(sections[activeSection].audio_file)}`}
                type="audio/mpeg"
              />
            </audio>
          </div>

          {/* Answer Input Grid */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>
              Nhập đáp án — Section {sections[activeSection].section_number}
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}>
              {getQuestionRange(sections[activeSection].question_range).map(q => {
                const isCorrect = checkAnswer(q)
                const dispAnswer = getDisplayAnswer(q)
                return (
                  <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="question-block__number">{q}</span>
                    <input
                      type="text"
                      className="input-answer"
                      value={answers[q] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [q]: e.target.value }))}
                      placeholder="Your answer"
                      disabled={isSubmitted}
                      style={{
                        flex: 1,
                        ...(isSubmitted && answerKey && answerKey[String(q)] ? {
                          borderColor: isCorrect ? 'var(--status-correct)' : 'var(--status-wrong)',
                          background: isCorrect ? '#f0fdf4' : '#fef2f2',
                        } : {})
                      }}
                    />
                    {isSubmitted && answerKey && answerKey[String(q)] && (
                      <div style={{
                        fontSize: '0.8rem',
                        color: isCorrect ? 'var(--status-correct)' : 'var(--status-wrong)',
                        fontWeight: 600,
                        minWidth: 80,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        {isCorrect ? '✓' : '✗'} <span style={{ color: 'var(--status-correct)' }}>{dispAnswer}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Question Palette (Moved here to make it a unified layout on the right) */}
          <div className="card">
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>
              Question Palette (Bảng câu hỏi)
            </h4>
            <div className="question-palette" style={{ boxShadow: 'none', padding: 0 }}>
              {Array.from({ length: 40 }, (_, i) => i + 1).map(q => {
                const isAnswered = (answers[q] ?? '').trim() !== ''
                const sectionIdx = sections.findIndex(s => {
                  const [start, end] = s.question_range.split('-').map(Number)
                  return q >= start && q <= end
                })
                const isInActiveSection = sectionIdx === activeSection
                return (
                  <div
                    key={q}
                    className={`question-palette__item ${isAnswered ? 'question-palette__item--answered' : ''} ${isInActiveSection ? 'question-palette__item--current' : ''}`}
                    onClick={() => {
                      if (sectionIdx >= 0) setActiveSection(sectionIdx)
                    }}
                    title={`Question ${q}`}
                  >
                    {q}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent-blue)' }} />
                Đã trả lời
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid var(--ielts-red)' }} />
                Section hiện tại
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid var(--border-light)' }} />
                Chưa trả lời
              </div>
            </div>
          </div>

          {/* Explanations (after submit) */}
          {isSubmitted && answerKey && (
            <div className="card" style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16 }}>
                📝 Giải thích đáp án — Section {sections[activeSection].section_number}
              </h4>
              <div style={{ display: 'grid', gap: 12 }}>
                {getQuestionRange(sections[activeSection].question_range).map(q => {
                  const ak = answerKey[String(q)]
                  if (!ak || !ak.explanation) return null
                  const isCorrect = checkAnswer(q)
                  const dispAnswer = getDisplayAnswer(q)
                  return (
                    <div key={q} style={{
                      padding: 12,
                      background: 'var(--bg-primary)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.82rem',
                      lineHeight: 1.6,
                      borderLeft: `3px solid ${isCorrect ? 'var(--status-correct)' : 'var(--status-wrong)'}`,
                    }}>
                      <strong style={{ color: isCorrect ? 'var(--status-correct)' : 'var(--status-wrong)' }}>
                        Câu {q}:
                      </strong>{' '}
                      <span style={{ color: 'var(--status-correct)', fontWeight: 600 }}>{dispAnswer}</span>
                      <br />
                      <span style={{ color: 'var(--text-secondary)' }}>{ak.explanation}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Result Modal */}
      {showResult && result && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          backdropFilter: 'blur(4px)',
        }}>
          <div className="result-card slide-up" style={{ maxWidth: 420, width: '90%' }}>
            <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎧</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>Listening Result</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
              Cambridge IELTS 11 — Test {test}
            </p>
            <div className="result-card__score">
              {result.correct ?? '?'}/{result.total ?? 40}
            </div>
            <div className="result-card__band" style={{ marginTop: 8 }}>
              Correct Answers
            </div>
            <div style={{
              marginTop: 16,
              padding: '8px 16px',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.9rem',
            }}>
              Band Score: <strong style={{ color: 'var(--ielts-red)' }}>
                {estimateListeningBand(result.correct ?? 0)}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
              <Link href={`/tests/${test}`}>
                <button className="btn btn-secondary">Quay lại</button>
              </Link>
              <button className="btn btn-primary" onClick={() => setShowResult(false)}>
                Xem chi tiết
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatQuestionContent(
  text: string,
  _answers: Record<number, string>,
  _setAnswers: any,
  _isSubmitted: boolean
): string {
  // Clean up artifacts and format nicely
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold section headers
    .replace(/(SECTION \d+)/g, '<strong style="color: var(--ielts-red); font-size: 1.1rem;">$1</strong>')
    .replace(/(Questions \d+-\d+)/g, '<strong style="color: var(--accent-blue);">$1</strong>')
    // Format question numbers
    .replace(/^(\d{1,2})\s/gm, '<span class="question-block__number" style="display:inline-flex;margin-right:4px">$1</span> ')
    // Format blanks
    .replace(/\.{5,}/g, '<span style="display:inline-block;min-width:120px;border-bottom:2px dashed var(--border-medium);margin:0 4px"></span>')
    // Format bullet points
    .replace(/•/g, '<span style="color:var(--ielts-red);margin-right:4px">•</span>')
    // Newlines to br
    .replace(/\n/g, '<br/>')

  return html
}
