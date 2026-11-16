"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Controller } from 'react-hook-form'
import { Alert, Button, Input, Result, Spin, Tabs, Tag } from 'antd'
import TimerOutlined from '@mui/icons-material/TimerOutlined'
import { useAnswerForm } from '@/lib/useAnswerForm'
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
  // Essays are form fields (task number -> text) managed by react-hook-form
  const { control, answers: essays, answerField } = useAnswerForm({ 1: '', 2: '' })
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
        const attemptResp = await fetch(`${BACKEND}/histories`, {
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
  const getWordCount = (text: string | undefined) => {
    const trimmed = (text ?? '').trim()
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
      await fetch(`${BACKEND}/histories/${attemptId}/submit`, {
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
        <Spin size="large" style={{ marginBottom: 16 }} />
        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Writing Test...</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Loading writing test...</div>
      </div>
    )
  }

  if (!content || !content.writing) {
    return (
      <div className="container">
        <Result
          status="error"
          title="Failed to load Writing test content."
          extra={<Link href={`/tests/${book}/${test}`}><Button type="primary">Back</Button></Link>}
        />
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
          <Tag color="orange" style={{ marginLeft: 8 }}>
            Word Count: {getWordCount(essays[1])} (Task 1) | {getWordCount(essays[2])} (Task 2)
          </Tag>
        </div>
        <div className="writing-timer-wrapper">
          <div className={timerClass}>
            <TimerOutlined fontSize="small" /> {formatTime(timeLeft)}
          </div>
          {!isSubmitted && (
            <Button type="primary" className="btn-submit" onClick={handleSubmit}>
              Submit
            </Button>
          )}
        </div>
      </div>

      <div className="split-view" style={{ gridTemplateColumns: '1.2fr 1px 1.2fr' }}>
        {/* Left Panel: Prompt or Model Answer PDF */}
        <div className="split-view__panel writing-left-panel">
          {/* PDF Viewer Tabs (Prompt / Model Answer) */}
          <Tabs
            className="writing-left-tabs"
            activeKey={viewMode}
            onChange={key => setViewMode(key as 'prompt' | 'model')}
            items={[
              { key: 'prompt', label: '📄 Writing Prompt' },
              ...(isSubmitted ? [{ key: 'model', label: '🎓 Model Answer' }] : []),
            ]}
          />
          <PDFViewer book={book} test={parseInt(test, 10)} partKey={viewMode === 'model' ? undefined : `writing_${activeTaskIndex + 1}`} pages={activePages} style={{ flexGrow: 1, padding: 4 }} />
        </div>

        {/* Divider */}
        <div className="split-view__divider" />

        {/* Right Panel: Editor Area */}
        <div className="split-view__panel writing-right-panel">
          {/* Task Switches */}
          <Tabs
            style={{ marginBottom: 8, flexShrink: 0 }}
            activeKey={String(activeTaskIndex)}
            onChange={key => {
              setActiveTaskIndex(Number(key))
              if (!isSubmitted) setViewMode('prompt')
            }}
            items={tasks.map((task, idx) => ({ key: String(idx), label: `Writing Task ${task.task_number}` }))}
          />

          {/* Text Editor Container */}
          <div className="writing-editor-container">
            <div className="writing-editor-header">
              <h3 className="writing-editor-title">
                Type your essay for Task {activeTaskIndex + 1}
              </h3>
              <Tag
                color={isWordCountMet ? 'success' : 'warning'}
              >
                ✍️ {currentWordCount} / {minWords} words
              </Tag>
            </div>

            <Controller
              key={activeTaskIndex}
              control={control}
              name={answerField(activeTaskIndex + 1)}
              render={({ field }) => (
                <Input.TextArea
                  {...field}
                  value={field.value ?? ''}
                  placeholder={`Type your Writing Task ${activeTaskIndex + 1} essay here. Remember it should be at least ${minWords} words long...`}
                  disabled={isSubmitted}
                  className="writing-textarea"
                  spellCheck={false}
                />
              )}
            />

            {/* Post-submission comparison card */}
            {isSubmitted && (
              <Alert
                className="writing-model-answer-info-card"
                type="info"
                showIcon
                message="Official Cambridge Model Answer"
                description={<>Click on the <strong>&quot;Model Answer&quot;</strong> tab on the left to compare your essay with the official model answer and read the detailed examiner comments.</>}
              />
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
        customMessage="Your Writing Task 1 & Task 2 essays have been successfully saved! You can view the Cambridge Model Answers on the left to compare and self-evaluate your work."
      />
    </div>
  )
}
