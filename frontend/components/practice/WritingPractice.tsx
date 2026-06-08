"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import PDFViewer from '@/components/PDFViewer'
import ResultModal from '@/components/ResultModal'

const BACKEND = '/api'
const DURATION_SECONDS = 60 * 60 // 60 minutes

type WritingTask = {
  task_number: number
  pages: number[]
  content_text: string
}

type ContentData = {
  writing?: {
    total_questions: number
    duration_minutes: number
    tasks: WritingTask[]
  }
}

interface WritingPracticeProps {
  test: string
}

export default function WritingPractice({ test }: WritingPracticeProps) {
  const [content, setContent] = useState<ContentData | null>(null)
  const [practiceLayout, setPracticeLayout] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTaskIndex, setActiveTaskIndex] = useState(0)
  const [essays, setEssays] = useState<Record<number, string>>({ 1: '', 2: '' })
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [viewMode, setViewMode] = useState<'prompt' | 'model'>('prompt') // prompt or model answer
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
          body: JSON.stringify({ book: 11, test: Number(test), skill: 'writing' }),
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

  const timerClass = timeLeft <= 120 ? 'timer timer--danger' : timeLeft <= 600 ? 'timer timer--warning' : 'timer'

  // Word count helper
  const getWordCount = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/).filter(w => w.length > 0).length
  }

  const activeTask = useMemo(() => {
    if (!content || !content.writing || !content.writing.tasks) return null
    return content.writing.tasks[activeTaskIndex]
  }, [content, activeTaskIndex])

  const activePages = useMemo(() => {
    if (viewMode === 'model') {
      const layout = practiceLayout?.writing?.[activeTaskIndex]
      if (layout && layout.model_answer_pages) {
        return layout.model_answer_pages
      }
      // Fallbacks if backend practiceLayout hasn't loaded yet
      const baseMap: Record<string, Record<number, number[]>> = {
        '1': { 0: [133], 1: [134] },
        '2': { 0: [135], 1: [136] },
        '3': { 0: [137], 1: [138] },
        '4': { 0: [139], 1: [140] }
      }
      return baseMap[test]?.[activeTaskIndex] || [133]
    }

    if (activeTask && activeTask.pages) return activeTask.pages

    // Static fallback
    const staticMap: Record<string, Record<number, number[]>> = {
      '1': { 0: [31], 1: [32] },
      '2': { 0: [55], 1: [56] },
      '3': { 0: [78], 1: [79] },
      '4': { 0: [101], 1: [102] }
    }
    return staticMap[test]?.[activeTaskIndex] || [31]
  }, [activeTask, activeTaskIndex, viewMode, practiceLayout, test])

  const handleSubmit = async () => {
    if (!attemptId) return
    setIsSubmitted(true)
    if (timerRef.current) clearInterval(timerRef.current)

    const responses = [
      { question_number: 1, answer: essays[1] },
      { question_number: 2, answer: essays[2] }
    ]

    try {
      await fetch(`${BACKEND}/attempts/${attemptId}/submit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      })
      setShowResult(true)
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) {
    return (
      <div className="container fade-in" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: '2rem', marginBottom: 16 }}>✍️</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Writing Test...</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Đang tải đề thi viết</div>
      </div>
    )
  }

  if (!content || !content.writing) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p>❌ Không thể tải nội dung bài thi Writing.</p>
          <Link href={`/tests/${test}`}>
            <button className="btn btn-primary" style={{ marginTop: 16 }}>Quay lại</button>
          </Link>
        </div>
      </div>
    )
  }

  const tasks = content.writing.tasks
  const currentEssayText = essays[activeTaskIndex + 1] ?? ''
  const currentWordCount = getWordCount(currentEssayText)
  const minWords = activeTaskIndex === 0 ? 150 : 250

  return (
    <div className="fade-in">
      {/* Exam Bar */}
      <div className="exam-bar">
        <div className="exam-bar__info">
          <span className="exam-bar__badge" style={{ backgroundColor: 'var(--accent-orange)' }}>Writing</span>
          <span>Cambridge IELTS 11 — Test {test}</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>
            Word Count: {getWordCount(essays[1])} (Task 1) | {getWordCount(essays[2])} (Task 2)
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

      <div className="split-view" style={{ gridTemplateColumns: '1.2fr 1px 1.2fr' }}>
        {/* Left Panel: Prompt or Model Answer PDF */}
        <div className="split-view__panel" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
          {/* PDF Viewer Tabs (Prompt / Model Answer) */}
          <div className="section-tabs" style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)', marginBottom: 0, flexShrink: 0 }}>
            <button
              className={`section-tab ${viewMode === 'prompt' ? 'section-tab--active' : ''}`}
              onClick={() => setViewMode('prompt')}
            >
              📄 Đề bài (Writing Prompt)
            </button>
            {isSubmitted && (
              <button
                className={`section-tab ${viewMode === 'model' ? 'section-tab--active' : ''}`}
                onClick={() => setViewMode('model')}
                style={{ borderLeft: '1px solid var(--border-light)' }}
              >
                🎓 Bài viết mẫu (Model Answer)
              </button>
            )}
          </div>
          <PDFViewer pages={activePages} style={{ flexGrow: 1, padding: 4 }} />
        </div>

        {/* Divider */}
        <div className="split-view__divider" />

        {/* Right Panel: Editor Area */}
        <div className="split-view__panel" style={{ background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', padding: '16px' }}>
          {/* Task Switches */}
          <div className="section-tabs" style={{ marginBottom: 16, flexShrink: 0 }}>
            {tasks.map((task, idx) => (
              <button
                key={task.task_number}
                className={`section-tab ${activeTaskIndex === idx ? 'section-tab--active' : ''}`}
                onClick={() => {
                  setActiveTaskIndex(idx)
                  // if not submitted, default back to prompt view mode
                  if (!isSubmitted) setViewMode('prompt')
                }}
              >
                Writing Task {task.task_number}
              </button>
            ))}
          </div>

          {/* Text Editor Container */}
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                Nhập bài viết của bạn cho Task {activeTaskIndex + 1}
              </h3>
              <div style={{
                fontSize: '0.85rem',
                color: currentWordCount >= minWords ? 'var(--status-correct)' : 'var(--text-muted)',
                fontWeight: 600,
                background: currentWordCount >= minWords ? '#f0fdf4' : 'var(--bg-secondary)',
                padding: '4px 12px',
                borderRadius: 20,
                border: `1px solid ${currentWordCount >= minWords ? 'var(--status-correct)' : 'var(--border-light)'}`,
                transition: 'all 0.2s'
              }}>
                ✍️ {currentWordCount} / {minWords} từ
              </div>
            </div>

            <textarea
              value={currentEssayText}
              onChange={e => setEssays(prev => ({ ...prev, [activeTaskIndex + 1]: e.target.value }))}
              placeholder={`Type your Writing Task ${activeTaskIndex + 1} essay here. Remember it should be at least ${minWords} words long...`}
              disabled={isSubmitted}
              style={{
                flexGrow: 1,
                width: '100%',
                minHeight: '320px',
                padding: '16px',
                fontSize: '1rem',
                lineHeight: 1.6,
                fontFamily: 'inherit',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-medium)',
                background: isSubmitted ? 'var(--bg-secondary)' : '#ffffff',
                resize: 'none',
                outline: 'none',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s',
                color: 'var(--text-primary)',
              }}
            />

            {/* Post-submission comparison card */}
            {isSubmitted && (
              <div className="card" style={{ marginTop: 12, borderLeft: '4px solid var(--accent-blue)', background: 'var(--bg-secondary)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 8 }}>
                  💡 Bài viết mẫu chính thức của Cambridge
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Hãy click vào tab <strong>"Bài viết mẫu (Model Answer)"</strong> bên trái để so sánh bài viết của bạn với bài viết mẫu đạt chuẩn và xem nhận xét chi tiết của giám khảo chấm thi Cambridge.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <ResultModal
        isOpen={showResult}
        emoji="✍️"
        title="Writing Attempt Saved"
        testNumber={test}
        correctCount={0}
        totalCount={0}
        bandScore="Saved"
        onClose={() => setShowResult(false)}
        backUrl={`/tests/${test}`}
        customMessage="Bài viết Writing Task 1 & Task 2 của bạn đã được lưu lại thành công! Bạn có thể xem các bài viết mẫu (Model Answers) của Cambridge để tự so sánh và đánh giá bài làm của mình."
      />
    </div>
  )
}
