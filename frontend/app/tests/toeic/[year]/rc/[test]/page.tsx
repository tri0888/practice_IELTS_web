"use client"

import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button, Spin, Tabs, Tag } from 'antd'
import TimerOutlined from '@mui/icons-material/TimerOutlined'
import { useAnswerForm } from '@/lib/useAnswerForm'
import ToeicOptionGroup from '@/components/practice/ToeicOptionGroup'
import ResultModal from '@/components/ResultModal/ResultModal'
import PDFViewer from '@/components/PDFViewer/PDFViewer'
import './page.css'

const BACKEND = '/api'
const DURATION_SECONDS = 75 * 60 // 75 minutes for TOEIC RC

type ActivePart = 'part5' | 'part6' | 'part7'

export default function ETSReadingPracticePage() {
  const params = useParams<{ year: string; test: string }>()
  const year = params?.year ?? '2026'
  const test = params?.test ?? '1'

  const { control, answers, answerField, resetAnswers } = useAnswerForm()
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [activePart, setActivePart] = useState<ActivePart>('part5')
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
          const ansResp = await fetch(`${BACKEND}/tests/toeic/${year}/answers/rc/${test}`)
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
          const attemptResp = await fetch(`${BACKEND}/histories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ book: parseInt(year, 10), test: parseInt(test, 10), skill: 'toeic_rc' })
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
          resetAnswers(initialAnswers)
          setLoading(false)
        }
      } catch (e) {
        console.error("Initialization failed", e)
        if (!cancelled) setLoading(false)
      }
    }

    initData()
    return () => { cancelled = true }
  }, [test, year, resetAnswers])

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

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter(val => val !== '').length
  }, [answers])

  // Filter questions by selected part
  const filteredQuestions = useMemo(() => {
    const allQs = Array.from({ length: 100 }, (_, i) => i + 101)

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
      fetch(`${BACKEND}/histories/${attemptId}/submit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: submissionResponses })
      }).catch(e => console.error("Failed to submit attempt", e))
    }
  }

  if (loading) {
    return (
      <div className="container fade-in" style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" style={{ marginBottom: 16 }} />
        <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>Loading TOEIC Reading Test...</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Preparing test and materials...</div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Top Exam Bar */}
      <div className="exam-bar" style={{ borderBottomColor: 'var(--status-correct, #22c55e)' }}>
        <div className="exam-bar__info">
          <span className="exam-bar__badge" style={{ background: '#22c55e' }}>TOEIC RC</span>
          <span>ETS {year} — Test {test}</span>
          <Tag color="green" style={{ marginLeft: 8 }}>
            {answeredCount}/100 completed
          </Tag>
        </div>
        <div className="listening-timer-wrapper">
          <div className={`timer ${timeLeft <= 300 ? 'timer--danger' : ''}`}>
            <TimerOutlined fontSize="small" /> {formatTime(timeLeft)}
          </div>
          {!isSubmitted && (
            <Button type="primary" className="btn-submit" style={{ background: '#22c55e' }} onClick={handleSubmit}>
              Submit
            </Button>
          )}
        </div>
      </div>

      {/* Main Split View */}
      <div className="split-view" style={{ gridTemplateColumns: '1.2fr 1px 1fr' }}>
        {/* Left Panel: PDF Viewer */}
        <div className="ets-pdf-container">
          <PDFViewer
            book={year}
            test={parseInt(test, 10)}
            pdfType="rc"
            partKey={`reading_${activePart.replace('part', '')}`}
            pages={[]}
            style={{ height: '100%', width: '100%', padding: 0 }}
          />
        </div>

        {/* Vertical Divider */}
        <div className="split-view__divider" />

        {/* Right Panel: Answer Sheet */}
        <div className="split-view__panel listening-split-panel" style={{ padding: '16px 12px 80px' }}>
          {/* Section Navigation Tabs */}
          <Tabs
            className="listening-tabs-wrapper"
            activeKey={activePart}
            onChange={key => setActivePart(key as ActivePart)}
            items={(['part5', 'part6', 'part7'] as const).map(part => ({ key: part, label: part.replace('part', 'Part ') }))}
          />

          {/* Answer Inputs Grid */}
          <div className="card" style={{ padding: '12px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Answer Sheet</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>* Questions 101 to 200</span>
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
                      background: isCorrect ? 'rgba(34, 197, 94, 0.08)' : 'rgba(220, 38, 38, 0.08)'
                    } : {})
                  }}>
                    <div className="ets-q-card__header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="ets-q-card__num">Question {q}</span>
                        <Tag>{getQuestionPartName(q)}</Tag>
                      </div>
                    </div>

                    <ToeicOptionGroup
                      control={control}
                      name={answerField(q)}
                      options={options}
                      disabled={isSubmitted}
                      correctAnswer={showFeedback ? correctAns : undefined}
                    />
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
        title="TOEIC Reading Result"
        testNumber={test}
        correctCount={correctCount}
        totalCount={100}
        bandScore={Object.keys(answerKey).length > 0 ? `${correctCount * 5}/495` : 'Submitted!'}
        onClose={() => setShowResult(false)}
        backUrl="/tests?type=toeic"
      />
    </div>
  )
}
