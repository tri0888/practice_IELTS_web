"use client"

import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ResultModal from '@/components/ResultModal/ResultModal'
import './page.css'

const BACKEND = '/api'
const DURATION_SECONDS = 75 * 60 // 75 minutes for TOEIC RC

type ActivePart = 'all' | 'part5' | 'part6' | 'part7'

export default function ETSReadingPracticePage() {
  const params = useParams<{ year: string; test: string }>()
  const year = params?.year ?? '2026'
  const test = params?.test ?? '1'

  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [activePart, setActivePart] = useState<ActivePart>('all')
  const [loading, setLoading] = useState(true)

  const [showResult, setShowResult] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [answerKey, setAnswerKey] = useState<Record<string, string>>({})
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load answers key placeholder
  useEffect(() => {
    let cancelled = false
    async function initData() {
      try {
        try {
          const ansResp = await fetch(`${BACKEND}/tests/ets/${year}/answers/rc/${test}`)
          if (ansResp.ok) {
            const data = await ansResp.json()
            if (!cancelled && data && data.answers) {
              setAnswerKey(data.answers)
            }
          }
        } catch (e) {
          console.error("Failed to load answers", e)
        }

        // Create attempt in DB
        try {
          const attemptResp = await fetch(`${BACKEND}/attempts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ book: parseInt(year, 10), test: parseInt(test, 10), skill: 'ets_rc' })
          })
          if (attemptResp.ok) {
            const att = await attemptResp.json()
            if (!cancelled && att && att.id) {
              setAttemptId(att.id)
            }
          }
        } catch (e) {
          console.error("Failed to create attempt", e)
        }

        if (!cancelled) {
          // Initialize answers for 101 to 200
          const initialAnswers: Record<number, string> = {}
          for (let i = 101; i <= 200; i++) {
            initialAnswers[i] = ''
          }
          setAnswers(initialAnswers)
          setLoading(false)
        }
      } catch (e) {
        console.error("Initialization failed", e)
        if (!cancelled) setLoading(false)
      }
    }

    initData()
    return () => { cancelled = true }
  }, [test, year])

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

  // Auto-submit
  useEffect(() => {
    if (timeLeft === 0 && !isSubmitted) {
      handleSubmit()
    }
  }, [timeLeft, isSubmitted])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleOptionChange = (qNum: number, option: string) => {
    if (isSubmitted) return
    setAnswers(prev => ({ ...prev, [qNum]: option }))
  }

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter(val => val !== '').length
  }, [answers])

  // Filter questions by selected part
  const filteredQuestions = useMemo(() => {
    const allQs = Array.from({ length: 100 }, (_, i) => i + 101)
    if (activePart === 'all') return allQs
    if (activePart === 'part5') return allQs.filter(q => q >= 101 && q <= 130)
    if (activePart === 'part6') return allQs.filter(q => q >= 131 && q <= 146)
    if (activePart === 'part7') return allQs.filter(q => q >= 147 && q <= 200)
    return allQs
  }, [activePart])

  const getQuestionPartName = (q: number) => {
    if (q >= 101 && q <= 130) return 'Part 5'
    if (q >= 131 && q <= 146) return 'Part 6'
    return 'Part 7'
  }

  const handleSubmit = () => {
    setIsSubmitted(true)
    if (timerRef.current) clearInterval(timerRef.current)

    // Calculate score if answerKey is available
    let score = 0
    let hasKeys = Object.keys(answerKey).length > 0
    if (hasKeys) {
      for (let i = 101; i <= 200; i++) {
        const userAns = answers[i]?.trim().toUpperCase()
        const correctAns = answerKey[String(i)]?.trim().toUpperCase()
        if (userAns && correctAns && userAns === correctAns) {
          score++
        }
      }
    }
    setCorrectCount(score)
    setShowResult(true)

    // Submit attempt to DB if attemptId is available
    if (attemptId) {
      const submissionResponses = Object.entries(answers).map(([qNum, ans]) => ({
        question_number: parseInt(qNum, 10),
        answer: ans
      }))
      fetch(`${BACKEND}/attempts/${attemptId}/submit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: submissionResponses })
      }).catch(e => console.error("Failed to submit attempt", e))
    }
  }

  if (loading) {
    return (
      <div className="container fade-in" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>📖</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>Đang tải đề thi TOEIC Reading...</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Đang chuẩn bị đề thi và tài liệu</div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Top Exam Bar */}
      <div className="exam-bar" style={{ borderBottomColor: 'var(--status-correct, #22c55e)' }}>
        <div className="exam-bar__info">
          <span className="exam-bar__badge" style={{ background: '#22c55e' }}>TOEIC RC</span>
          <span>ETS {year} — Đề thi {test}</span>
          <span className="listening-answered-badge">
            {answeredCount}/100 đã làm
          </span>
        </div>
        <div className="listening-timer-wrapper">
          <div className={`timer ${timeLeft <= 300 ? 'timer--danger' : ''}`}>
            ⏱️ {formatTime(timeLeft)}
          </div>
          {!isSubmitted && (
            <button className="btn btn-submit btn-sm" style={{ background: '#22c55e', borderColor: '#22c55e' }} onClick={handleSubmit}>
              Nộp bài
            </button>
          )}
        </div>
      </div>

      {/* Main Split View */}
      <div className="split-view" style={{ gridTemplateColumns: '1.2fr 1px 1fr' }}>
        {/* Left Panel: PDF Viewer in Iframe */}
        <div className="ets-pdf-container">
          <iframe
            src={`${BACKEND}/tests/ets/${year}/pdf/rc/${test}#toolbar=0`}
            className="ets-pdf-iframe"
            title={`ETS ${year} RC Test ${test}`}
          />
        </div>

        {/* Vertical Divider */}
        <div className="split-view__divider" />

        {/* Right Panel: Answer Sheet */}
        <div className="split-view__panel listening-split-panel" style={{ padding: '16px 12px 80px' }}>
          {/* Section Navigation Tabs */}
          <div className="section-tabs listening-tabs-wrapper">
            {(['all', 'part5', 'part6', 'part7'] as const).map(part => (
              <button
                key={part}
                className={`section-tab ${activePart === part ? 'section-tab--active' : ''}`}
                onClick={() => setActivePart(part)}
                style={{ textTransform: 'capitalize' }}
              >
                {part === 'all' ? 'Tất cả' : part.replace('part', 'Part ')}
              </button>
            ))}
          </div>

          {/* Answer Inputs Grid */}
          <div className="card" style={{ padding: '12px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Phiếu trả lời trắc nghiệm</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>* Câu 101 đến 200</span>
            </h3>

            <div className="ets-q-grid">
              {filteredQuestions.map(q => {
                const options = ['A', 'B', 'C', 'D']
                const userAns = answers[q]
                const correctAns = answerKey[String(q)]
                const isCorrect = userAns === correctAns
                const showFeedback = isSubmitted && correctAns

                return (
                  <div key={q} className="ets-q-card" style={{
                    ...(showFeedback ? {
                      borderColor: isCorrect ? 'var(--status-correct)' : 'var(--status-wrong)',
                      background: isCorrect ? '#f0fdf4' : '#fef2f2'
                    } : {})
                  }}>
                    <div className="ets-q-card__header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="ets-q-card__num">Câu {q}</span>
                        <span className="part-badge">{getQuestionPartName(q)}</span>
                      </div>
                    </div>

                    <div className="ets-options-group">
                      {options.map(opt => {
                        const optionId = `q-${q}-${opt}`
                        return (
                          <div key={opt} style={{ flex: 1 }}>
                            <input
                              type="radio"
                              id={optionId}
                              name={`question-${q}`}
                              value={opt}
                              checked={answers[q] === opt}
                              onChange={() => handleOptionChange(q, opt)}
                              disabled={isSubmitted}
                              className="ets-option-input"
                            />
                            <label
                              htmlFor={optionId}
                              className="ets-option-label"
                              style={{
                                ...(showFeedback && opt === correctAns ? {
                                  background: 'var(--status-correct, #22c55e)',
                                  borderColor: 'var(--status-correct, #22c55e)',
                                  color: 'white'
                                } : {}),
                                ...(showFeedback && userAns === opt && !isCorrect ? {
                                  background: 'var(--status-wrong, #ef4444)',
                                  borderColor: 'var(--status-wrong, #ef4444)',
                                  color: 'white'
                                } : {})
                              }}
                            >
                              {opt}
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <ResultModal
        isOpen={showResult}
        emoji="🎯"
        title="Kết quả TOEIC Reading"
        testNumber={test}
        correctCount={correctCount}
        totalCount={100}
        bandScore={Object.keys(answerKey).length > 0 ? `${correctCount * 5}/495` : 'Đã nộp bài!'}
        onClose={() => setShowResult(false)}
        backUrl="/"
      />
    </div>
  )
}
