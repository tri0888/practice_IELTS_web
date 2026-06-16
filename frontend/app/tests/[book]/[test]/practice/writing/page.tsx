"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import PDFViewer from '@/components/PDFViewer/PDFViewer'
import ResultModal from '@/components/ResultModal/ResultModal'
import './page.css'

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

export default function WritingPracticePage() {
  const params = useParams<{ book: string; test: string }>()
  const book = params?.book ?? '11'
  const test = params?.test ?? '1'

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
        const defaultContent: ContentData = {
          writing: {
            total_questions: 2,
            duration_minutes: 60,
            tasks: [
              { task_number: 1, pages: [], content_text: '' },
              { task_number: 2, pages: [], content_text: '' }
            ]
          }
        }
        if (!cancelled) {
          setContent(defaultContent)
        }

        // Load practice layout
        try {
          const practiceResp = await fetch(`${BACKEND}/tests/${book}/${test}/practice`)
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
          body: JSON.stringify({ book: Number(book), test: Number(test), skill: 'writing' }),
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
  }, [book, test])

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
          <Link href={`/tests/${book}/${test}`}>
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
  const isWordCountMet = currentWordCount >= minWords

  return (
    <div className="fade-in">
      {/* Exam Bar */}
      <div className="exam-bar">
        <div className="exam-bar__info">
          <span className="exam-bar__badge" style={{ backgroundColor: 'var(--accent-orange)' }}>Writing</span>
          <span>Cambridge IELTS {book} — Test {test}</span>
          <span className="writing-word-count-badge-top">
            Word Count: {getWordCount(essays[1])} (Task 1) | {getWordCount(essays[2])} (Task 2)
          </span>
        </div>
        <div className="writing-timer-wrapper">
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
        <div className="split-view__panel writing-left-panel">
          {/* PDF Viewer Tabs (Prompt / Model Answer) */}
          <div className="section-tabs writing-left-tabs">
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
          <PDFViewer book={book} test={parseInt(test, 10)} partKey={viewMode === 'model' ? undefined : `writing_${activeTaskIndex + 1}`} pages={activePages} style={{ flexGrow: 1, padding: 4 }} />
        </div>

        {/* Divider */}
        <div className="split-view__divider" />

        {/* Right Panel: Editor Area */}
        <div className="split-view__panel writing-right-panel">
          {/* Task Switches */}
          <div className="section-tabs" style={{ marginBottom: 16, flexShrink: 0 }}>
            {tasks.map((task, idx) => (
              <button
                key={task.task_number}
                className={`section-tab ${activeTaskIndex === idx ? 'section-tab--active' : ''}`}
                onClick={() => {
                  setActiveTaskIndex(idx)
                  if (!isSubmitted) setViewMode('prompt')
                }}
              >
                Writing Task {task.task_number}
              </button>
            ))}
          </div>

          {/* Text Editor Container */}
          <div className="writing-editor-container">
            <div className="writing-editor-header">
              <h3 className="writing-editor-title">
                Nhập bài viết của bạn cho Task {activeTaskIndex + 1}
              </h3>
              <div className={`writing-word-count-badge ${isWordCountMet ? 'writing-word-count-badge--complete' : 'writing-word-count-badge--incomplete'}`}>
                ✍️ {currentWordCount} / {minWords} từ
              </div>
            </div>

            <textarea
              value={currentEssayText}
              onChange={e => setEssays(prev => ({ ...prev, [activeTaskIndex + 1]: e.target.value }))}
              placeholder={`Type your Writing Task ${activeTaskIndex + 1} essay here. Remember it should be at least ${minWords} words long...`}
              disabled={isSubmitted}
              className="writing-textarea"
            />

            {/* Post-submission comparison card */}
            {isSubmitted && (
              <div className="card writing-model-answer-info-card">
                <h4 className="writing-model-answer-info-card__title">
                  💡 Bài viết mẫu chính thức của Cambridge
                </h4>
                <p className="writing-model-answer-info-card__desc">
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
        backUrl={`/tests/${book}/${test}`}
        customMessage="Bài viết Writing Task 1 & Task 2 của bạn đã được lưu lại thành công! Bạn có thể xem các bài viết mẫu (Model Answers) của Cambridge để tự so sánh và đánh giá bài làm của mình."
      />
    </div>
  )
}
