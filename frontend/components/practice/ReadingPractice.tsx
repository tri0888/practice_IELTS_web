"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import PDFViewer from '@/components/PDFViewer'
import ResultModal from '@/components/ResultModal'

const BACKEND = '/api'
const DURATION_SECONDS = 60 * 60 // 60 minutes

type Passage = {
  passage_number: number
  title: string
  passage_text: string
  question_range: string
  questions_text: string
}

type ContentData = {
  reading: {
    total_questions: number
    duration_minutes: number
    passages: Passage[]
  }
}

interface ReadingPracticeProps {
  test: string
}

interface QuestionGroup {
  range: string
  start: number
  end: number
  text: string
}

function parseQuestionGroups(text: string): QuestionGroup[] {
  if (!text) return []
  const regex = /^Questions\s+(\d+)-(\d+)/gim
  const groups: QuestionGroup[] = []
  let match
  
  const matches: { index: number; range: string; start: number; end: number }[] = []
  while ((match = regex.exec(text)) !== null) {
    const startNum = parseInt(match[1], 10)
    const endNum = parseInt(match[2], 10)
    matches.push({
      index: match.index,
      range: `${startNum}-${endNum}`,
      start: startNum,
      end: endNum
    })
  }
  
  if (matches.length === 0) {
    return [{
      range: 'all',
      start: 1,
      end: 40,
      text: text
    }]
  }
  
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : text.length
    const groupText = text.substring(current.index, nextIndex).trim()
    groups.push({
      range: current.range,
      start: current.start,
      end: current.end,
      text: groupText
    })
  }
  
  return groups
}

function estimateBand(correct: number, total: number): string {
  const score = correct
  if (score >= 39) return '9.0'
  if (score >= 37) return '8.5'
  if (score >= 35) return '8.0'
  if (score >= 33) return '7.5'
  if (score >= 30) return '7.0'
  if (score >= 27) return '6.5'
  if (score >= 23) return '6.0'
  if (score >= 19) return '5.5'
  if (score >= 15) return '5.0'
  if (score >= 13) return '4.5'
  if (score >= 10) return '4.0'
  if (score >= 8) return '3.5'
  if (score >= 6) return '3.0'
  if (score >= 4) return '2.5'
  return '2.0'
}

export default function ReadingPractice({ test }: ReadingPracticeProps) {
  const [content, setContent] = useState<ContentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePassage, setActivePassage] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [answerKey, setAnswerKey] = useState<Record<string, { answer: string; explanation: string }> | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [activeGroupIndex, setActiveGroupIndex] = useState(0)
  const [practiceLayout, setPracticeLayout] = useState<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const passagePanelRef = useRef<HTMLDivElement>(null)

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
          }
        } catch (e) {
          console.error("Failed to load practice layout:", e)
        }

        // Create attempt
        const attemptResp = await fetch(`${BACKEND}/attempts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book: 11, test: Number(test), skill: 'reading' }),
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

  useEffect(() => {
    if (timeLeft === 0 && !isSubmitted) handleSubmit()
  }, [timeLeft, isSubmitted])

  // Scroll passage to top when switching passages
  useEffect(() => {
    if (passagePanelRef.current) {
      passagePanelRef.current.scrollTop = 0
    }
  }, [activePassage])

  const groups = useMemo(() => {
    if (!content || !content.reading || !content.reading.passages) return []
    const passagesList = content.reading.passages
    const currentPassageData = passagesList[activePassage]
    if (!currentPassageData) return []

    // Try to get groups from practiceLayout first to ensure we have all groups (even with OCR errors)
    if (practiceLayout && practiceLayout.reading) {
      const layout = practiceLayout.reading.find((p: any) => p.passage === activePassage + 1)
      if (layout && layout.groups) {
        return layout.groups.map((g: any) => {
          const parts = g.range.split('-')
          const start = Number(parts[0])
          const end = parts[1] ? Number(parts[1]) : start
          return {
            range: g.range,
            start,
            end,
            title: g.title,
            page: g.page
          }
        })
      }
    }

    return parseQuestionGroups(currentPassageData.questions_text)
  }, [content, activePassage, practiceLayout])

  // Safeguard: Reset activeGroupIndex if it is out of bounds for the current passage's groups
  useEffect(() => {
    if (groups.length > 0 && activeGroupIndex >= groups.length) {
      setActiveGroupIndex(0)
    }
  }, [groups, activeGroupIndex])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const timerClass = timeLeft <= 120 ? 'timer timer--danger' : timeLeft <= 600 ? 'timer timer--warning' : 'timer'

  const answeredCount = useMemo(() =>
    Object.values(answers).filter(a => a.trim() !== '').length
  , [answers])

  const passagePages = useMemo(() => {
    if (!practiceLayout || !practiceLayout.reading) {
      const pNum = activePassage + 1
      const map: Record<number, number[]> = {
        1: [19, 20],
        2: [22, 23],
        3: [26, 27]
      }
      return map[pNum] || []
    }
    const layout = practiceLayout.reading.find((p: any) => p.passage === activePassage + 1)
    return layout?.passage_pages || []
  }, [activePassage, practiceLayout])

  const activeQuestionPage = useMemo(() => {
    if (!practiceLayout || !practiceLayout.reading) {
      const pNum = activePassage + 1
      const map: Record<number, number[]> = {
        1: [21, 21],
        2: [24, 25],
        3: [28, 29, 30]
      }
      const pages = map[pNum]
      if (pages && pages[activeGroupIndex] !== undefined) {
        return pages[activeGroupIndex]
      }
      const defaultMap: Record<number, number> = { 1: 21, 2: 24, 3: 28 }
      return defaultMap[pNum] || 21
    }

    const layout = practiceLayout.reading.find((p: any) => p.passage === activePassage + 1)
    if (layout && layout.groups && layout.groups[activeGroupIndex]) {
      return layout.groups[activeGroupIndex].page
    }
    return 21
  }, [activePassage, activeGroupIndex, practiceLayout])

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

  const getPassageForQuestion = (q: number): number => {
    if (!content) return 0
    return content.reading.passages.findIndex(p => {
      const [start, end] = p.question_range.split('-').map(Number)
      return q >= start && q <= end
    })
  }

  if (loading) {
    return (
      <div className="container fade-in" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: '2rem', marginBottom: 16 }}>📖</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Reading Test...</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Đang tải nội dung bài thi</div>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p>❌ Không thể tải nội dung bài thi.</p>
          <Link href={`/tests/${test}`}>
            <button className="btn btn-primary" style={{ marginTop: 16 }}>Quay lại</button>
          </Link>
        </div>
      </div>
    )
  }

  const passages = content.reading.passages
  const currentPassage = passages[activePassage]
  const activeGroup = groups[activeGroupIndex] || groups[0] || { range: '1-40', start: 1, end: 40, text: '' }

  return (
    <div className="fade-in">
      {/* Exam Bar */}
      <div className="exam-bar">
        <div className="exam-bar__info">
          <span className="exam-bar__badge">Reading</span>
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

      {/* Passage Tabs */}
      <div style={{
        padding: '8px 24px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div className="section-tabs" style={{ marginBottom: 0 }}>
          {passages.map((passage, idx) => (
            <button
              key={passage.passage_number}
              className={`section-tab ${activePassage === idx ? 'section-tab--active' : ''}`}
              onClick={() => {
                setActivePassage(idx)
                setActiveGroupIndex(0)
              }}
            >
              Passage {passage.passage_number}
            </button>
          ))}
        </div>
        {/* Mini question palette */}
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: 40 }, (_, i) => i + 1).map(q => {
            const isAnswered = (answers[q] ?? '').trim() !== ''
            const pIdx = getPassageForQuestion(q)
            const isActive = pIdx === activePassage
            return (
              <div
                key={q}
                onClick={() => {
                  if (pIdx >= 0) {
                    setActivePassage(pIdx)
                    const targetPassage = passages[pIdx]
                    if (targetPassage) {
                      const targetGroups = parseQuestionGroups(targetPassage.questions_text)
                      const groupIdx = targetGroups.findIndex(g => q >= g.start && q <= g.end)
                      if (groupIdx >= 0) {
                        setActiveGroupIndex(groupIdx)
                      }
                    }
                  }
                }}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.55rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: isAnswered ? 'var(--accent-blue)' : isActive ? 'var(--bg-primary)' : 'transparent',
                  color: isAnswered ? 'white' : 'var(--text-muted)',
                  border: isActive && !isAnswered ? '1px solid var(--ielts-red)' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
                title={`Question ${q}`}
              >
                {q}
              </div>
            )
          })}
        </div>
      </div>

      {/* Split View */}
      <div className="split-view-3">
        {/* Left: Passage PDF */}
        <PDFViewer pages={passagePages} containerRef={passagePanelRef} />

        {/* Divider */}
        <div className="split-view-3__divider" />

        {/* Middle: Questions PDF */}
        <div className="split-view-3__panel" style={{ background: 'var(--bg-primary)', padding: '4px' }}>
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Group Tabs */}
            <div className="section-tabs" style={{ marginBottom: 16, flexShrink: 0 }}>
              {groups.map((group, idx) => (
                <button
                  key={group.range}
                  className={`section-tab ${activeGroupIndex === idx ? 'section-tab--active' : ''}`}
                  onClick={() => setActiveGroupIndex(idx)}
                >
                  {group.range === 'all' ? 'Tất cả' : `Câu ${group.range}`}
                </button>
              ))}
            </div>

            {/* Questions PDF page */}
            <PDFViewer pages={[activeQuestionPage]} style={{ padding: 0, background: 'transparent', flexGrow: 1 }} />
          </div>
        </div>

        {/* Divider */}
        <div className="split-view-3__divider" />

        {/* Right: Answer Inputs */}
        <div className="split-view-3__panel" style={{ background: 'var(--bg-secondary)' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            {/* Answer Inputs */}
            <div className="card">
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16 }}>
                Nhập đáp án — Nhóm {activeGroup?.range === 'all' ? 'Tất cả' : activeGroup?.range}
              </h4>
              <div style={{ display: 'grid', gap: 10 }}>
                {getQuestionRange(activeGroup?.range ?? currentPassage.question_range).map(q => (
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
                          borderColor: (answers[q] ?? '').trim().toLowerCase() === (answerKey[String(q)]?.answer ?? '').split(' ')[0].trim().toLowerCase()
                            ? 'var(--status-correct)'
                            : 'var(--status-wrong)',
                          background: (answers[q] ?? '').trim().toLowerCase() === (answerKey[String(q)]?.answer ?? '').split(' ')[0].trim().toLowerCase()
                            ? '#f0fdf4'
                            : '#fef2f2',
                        } : {})
                      }}
                    />
                    {isSubmitted && answerKey && answerKey[String(q)] && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--status-correct)', fontWeight: 600, minWidth: 100 }}>
                        ✓ {answerKey[String(q)].answer.split(' ')[0]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Explanations (after submit, filtered by active group) */}
            {isSubmitted && answerKey && (
              <div className="card" style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16 }}>
                  📝 Giải thích đáp án
                </h4>
                <div style={{ display: 'grid', gap: 12 }}>
                  {getQuestionRange(activeGroup?.range ?? currentPassage.question_range).map(q => {
                    const ak = answerKey[String(q)]
                    if (!ak || !ak.explanation) return null
                    return (
                      <div key={q} style={{
                        padding: 12,
                        background: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                        lineHeight: 1.6,
                        borderLeft: '3px solid var(--accent-blue)',
                      }}>
                        <strong style={{ color: 'var(--accent-blue)' }}>Câu {q}:</strong>{' '}
                        <span style={{ color: 'var(--status-correct)', fontWeight: 600 }}>{ak.answer.split(' ')[0]}</span>
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
      </div>

      {/* Result Modal */}
      <ResultModal
        isOpen={showResult && !!result}
        emoji="📖"
        title="Reading Result"
        testNumber={test}
        correctCount={result?.correct ?? 0}
        totalCount={result?.total ?? 40}
        bandScore={estimateBand(result?.correct ?? 0, result?.total ?? 40)}
        onClose={() => setShowResult(false)}
        backUrl={`/tests/${test}`}
      />
    </div>
  )
}
