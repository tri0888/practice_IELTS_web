"use client"

import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button, Spin, Tabs, Tag } from 'antd'
import PauseRounded from '@mui/icons-material/PauseRounded'
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded'
import TimerOutlined from '@mui/icons-material/TimerOutlined'
import VolumeUpRounded from '@mui/icons-material/VolumeUpRounded'
import { useAnswerForm } from '@/lib/useAnswerForm'
import ToeicOptionGroup from '@/components/practice/ToeicOptionGroup'
import ResultModal from '@/components/ResultModal/ResultModal'
import PDFViewer from '@/components/PDFViewer/PDFViewer'
import { getAuthUrl } from '@/components/AuthProvider/AuthProvider'
import './page.css'

const BACKEND = '/api'
const DURATION_SECONDS = 45 * 60 // 45 minutes for TOEIC LC

type ActivePart = 'part1' | 'part2' | 'part3' | 'part4'

export default function ETSListeningPracticePage() {
  const params = useParams<{ year: string; test: string }>()
  const year = params?.year ?? '2026'
  const test = params?.test ?? '1'

  const [audioFiles, setAudioFiles] = useState<string[]>([])
  const { control, answers, answerField, resetAnswers } = useAnswerForm()
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [activePart, setActivePart] = useState<ActivePart>('part1')
  const [loading, setLoading] = useState(true)

  // Audio Playback State
  const [currentAudio, setCurrentAudio] = useState<string | null>(null)
  const [playingQuestion, setPlayingQuestion] = useState<number | null>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

  const [showResult, setShowResult] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [answerKey, setAnswerKey] = useState<Record<string, string>>({})
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load Audios and Answers
  useEffect(() => {
    let cancelled = false
    async function initData() {
      try {
        // Fetch audio list
        const audioResp = await fetch(`${BACKEND}/tests/toeic/${year}/audio/${test}`)
        if (audioResp.ok) {
          const files = await audioResp.json()
          if (!cancelled) setAudioFiles(files)
        }

        // Fetch answer key placeholder or actual answers if available
        try {
          const ansResp = await fetch(`${BACKEND}/tests/toeic/${year}/answers/lc/${test}`)
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
            body: JSON.stringify({ book: parseInt(year, 10), test: parseInt(test, 10), skill: 'toeic_lc' })
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
          // Initialize answers for 1 to 100
          const initialAnswers: Record<number, string> = {}
          for (let i = 1; i <= 100; i++) {
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

  // Helper to map question to its audio file
  const getAudioFile = (qNum: number) => {
    if (!audioFiles || audioFiles.length === 0) return null
    for (const file of audioFiles) {
      const base = file.replace('.mp3', '')
      const parts = base.split('-')
      if (parts.length < 2) continue

      const lastPart = parts[parts.length - 1]
      const secondLastPart = parts[parts.length - 2]

      const lastNum = parseInt(lastPart, 10)
      const secondLastNum = parseInt(secondLastPart, 10)

      if (!isNaN(lastNum) && !isNaN(secondLastNum)) {
        // It's a range like "32-34"
        if (qNum >= secondLastNum && qNum <= lastNum) {
          return file
        }
      } else if (!isNaN(lastNum)) {
        // It's a single question like "01"
        if (lastNum === qNum) {
          return file
        }
      }
    }
    return null
  }

  // Play audio for a question
  const handlePlayAudio = (qNum: number) => {
    const file = getAudioFile(qNum)
    if (!file) return

    const audioUrl = getAuthUrl(`${BACKEND}/tests/toeic/${year}/audio-file/${test}/${encodeURIComponent(file)}`)
    
    if (playingQuestion === qNum) {
      // Toggle play/pause
      if (audioPlayerRef.current) {
        if (audioPlayerRef.current.paused) {
          audioPlayerRef.current.play()
        } else {
          audioPlayerRef.current.pause()
        }
      }
    } else {
      setCurrentAudio(file)
      setPlayingQuestion(qNum)
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioUrl
        audioPlayerRef.current.play()
      }
    }
  }

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter(val => val !== '').length
  }, [answers])

  // Filter questions by selected part
  const filteredQuestions = useMemo(() => {
    const allQs = Array.from({ length: 100 }, (_, i) => i + 1)

    if (activePart === 'part1') return allQs.filter(q => q >= 1 && q <= 6)
    if (activePart === 'part2') return allQs.filter(q => q >= 7 && q <= 31)
    if (activePart === 'part3') return allQs.filter(q => q >= 32 && q <= 70)
    if (activePart === 'part4') return allQs.filter(q => q >= 71 && q <= 100)
    return allQs
  }, [activePart])

  const getQuestionPartName = (q: number) => {
    if (q >= 1 && q <= 6) return 'Part 1'
    if (q >= 7 && q <= 31) return 'Part 2'
    if (q >= 32 && q <= 70) return 'Part 3'
    return 'Part 4'
  }

  const handleSubmit = () => {
    setIsSubmitted(true)
    if (timerRef.current) clearInterval(timerRef.current)
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
    }
    setPlayingQuestion(null)

    // Calculate score if answerKey is available
    let score = 0
    let hasKeys = Object.keys(answerKey).length > 0
    if (hasKeys) {
      for (let i = 1; i <= 100; i++) {
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
        <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>Loading TOEIC Listening Test...</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Preparing audio files and materials...</div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Top Exam Bar */}
      <div className="exam-bar">
        <div className="exam-bar__info">
          <span className="exam-bar__badge" style={{ background: '#3b82f6' }}>TOEIC LC</span>
          <span>ETS {year} — Test {test}</span>
          <Tag color="blue" style={{ marginLeft: 8 }}>
            {answeredCount}/100 completed
          </Tag>
        </div>
        <div className="listening-timer-wrapper">
          <div className={`timer ${timeLeft <= 300 ? 'timer--danger' : ''}`}>
            <TimerOutlined fontSize="small" /> {formatTime(timeLeft)}
          </div>
          {!isSubmitted && (
            <Button type="primary" className="btn-submit" onClick={handleSubmit}>
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
            pdfType="lc"
            partKey={`listening_${activePart.replace('part', '')}`}
            pages={[]}
            style={{ height: '100%', width: '100%', padding: 0 }}
          />
        </div>

        {/* Vertical Divider */}
        <div className="split-view__divider" />

        {/* Right Panel: Answer Sheet & Media Controls */}
        <div className="split-view__panel listening-split-panel" style={{ padding: '16px 12px 80px' }}>
          {/* Section Navigation Tabs */}
          <Tabs
            className="listening-tabs-wrapper"
            activeKey={activePart}
            onChange={key => setActivePart(key as ActivePart)}
            items={(['part1', 'part2', 'part3', 'part4'] as const).map(part => ({ key: part, label: part.replace('part', 'Part ') }))}
          />

          {/* Persistent Mini Audio Player */}
          <div className="ets-audio-bar">
            <div className="ets-audio-bar__header">
              <span><VolumeUpRounded fontSize="small" /> Question Audio Player</span>
              {currentAudio && (
                <span style={{ color: '#2563eb', fontWeight: 600 }}>
                  Playing: {currentAudio}
                </span>
              )}
            </div>
            <audio
              ref={audioPlayerRef}
              controls
              className="ets-audio-bar__player"
              onEnded={() => setPlayingQuestion(null)}
            />
          </div>

          {/* Answer Inputs Grid */}
          <div className="card" style={{ padding: '12px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Answer Sheet</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>* Part 2 has 3 choices (A-B-C)</span>
            </h3>

            <div className="ets-q-grid">
              {filteredQuestions.map(q => {
                const hasAudio = !!getAudioFile(q)
                const isPart2 = q >= 7 && q <= 31
                const options = isPart2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']
                
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
                      
                      {hasAudio && (
                        <Button
                          size="small"
                          type={playingQuestion === q ? 'primary' : 'default'}
                          className={`ets-q-card__audio-btn ${playingQuestion === q ? 'ets-q-card__audio-btn--playing' : ''}`}
                          icon={playingQuestion === q ? <PauseRounded fontSize="small" /> : <PlayArrowRounded fontSize="small" />}
                          onClick={() => handlePlayAudio(q)}
                        >
                          {playingQuestion === q ? 'Pause' : 'Listen'}
                        </Button>
                      )}
                    </div>

                    <ToeicOptionGroup
                      control={control}
                      name={answerField(q)}
                      options={options}
                      disabled={isSubmitted}
                      correctAnswer={showFeedback ? correctAns : undefined}
                      className={isPart2 ? 'ets-options-group--3' : undefined}
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
        title="TOEIC Listening Result"
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
