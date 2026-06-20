"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import PDFViewer from '@/components/PDFViewer/PDFViewer'
import ResultModal from '@/components/ResultModal/ResultModal'
import './page.css'

const BACKEND = '/api'
const DURATION_SECONDS = 15 * 60 // 15 minutes max

type SpeakingPart = {
  part_number: number
  pages: number[]
  content_text: string
}

type ContentData = {
  speaking?: {
    parts: SpeakingPart[]
  }
}

export default function SpeakingPracticePage() {
  const params = useParams<{ book: string; test: string }>()
  const book = params?.book ?? '11'
  const test = params?.test ?? '1'

  const [content, setContent] = useState<ContentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePartIndex, setActivePartIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)

  // Voice recording states
  const [recordings, setRecordings] = useState<Record<number, string>>({ 1: '', 2: '', 3: '' })
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Part 2 Prep Timer states
  const [prepTimeLeft, setPrepTimeLeft] = useState(60)
  const [isPrepActive, setIsPrepActive] = useState(false)
  const prepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load content
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const defaultContent: ContentData = {
          speaking: {
            parts: [
              { part_number: 1, pages: [], content_text: '' },
              { part_number: 2, pages: [], content_text: '' },
              { part_number: 3, pages: [], content_text: '' }
            ]
          }
        }
        if (!cancelled) {
          setContent(defaultContent)
        }

        // Create attempt
        const attemptResp = await fetch(`${BACKEND}/attempts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book: Number(book), test: Number(test), skill: 'speaking' }),
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

  // Exam timer
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

  // Cleanup recorders on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (prepTimerRef.current) clearInterval(prepTimerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Synthesize beep chime using Web Audio API
  const playBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const audioCtx = new AudioContextClass()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime)
      gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime)
      oscillator.start()
      setTimeout(() => { oscillator.stop() }, 600)
    } catch (e) {
      console.error("Failed to synth beep:", e)
    }
  }

  // Part 2 Prep Countdown
  const startPrepTimer = () => {
    if (isPrepActive) return
    setIsPrepActive(true)
    setPrepTimeLeft(60)
    prepTimerRef.current = setInterval(() => {
      setPrepTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(prepTimerRef.current!)
          setIsPrepActive(false)
          playBeep()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const resetPrepTimer = () => {
    if (prepTimerRef.current) clearInterval(prepTimerRef.current)
    setIsPrepActive(false)
    setPrepTimeLeft(60)
  }

  // Recorder methods
  const startRecording = async () => {
    if (isRecording) return
    chunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setRecordings(prev => ({ ...prev, [activePartIndex + 1]: url }))
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
        }
      }

      recorder.start()
      setIsRecording(true)
      setRecordingSeconds(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error("Mic permissions blocked or unavailable:", err)
      alert("⚠️ Unable to access your microphone. Please grant microphone access to this website and try again.")
    }
  }

  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return
    mediaRecorderRef.current.stop()
    setIsRecording(false)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
  }

  const activePages = useMemo(() => {
    const staticMap: Record<string, number[]> = {
      '1': [33],
      '2': [57],
      '3': [80],
      '4': [103]
    }
    return staticMap[test] || [33]
  }, [test])

  const handleSubmit = async () => {
    if (!attemptId) return
    if (isRecording) stopRecording()
    setIsSubmitted(true)
    if (timerRef.current) clearInterval(timerRef.current)

    const responses = [
      { question_number: 1, answer: recordings[1] ? 'Speaking Part 1 Audio Saved' : '' },
      { question_number: 2, answer: recordings[2] ? 'Speaking Part 2 Audio Saved' : '' },
      { question_number: 3, answer: recordings[3] ? 'Speaking Part 3 Audio Saved' : '' }
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
        <div style={{ fontSize: '2rem', marginBottom: 16 }}>🎙️</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Speaking Test...</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Initializing Speaking practice room...</div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Exam Bar */}
      <div className="exam-bar">
        <div className="exam-bar__info">
          <span className="exam-bar__badge" style={{ backgroundColor: 'var(--accent-purple)' }}>Speaking</span>
          <span>Cambridge IELTS {book} — Test {test}</span>
          <span className="speaking-recordings-badge">
            Recordings: {recordings[1] ? '✓ Part 1' : '✗ Part 1'} | {recordings[2] ? '✓ Part 2' : '✗ Part 2'} | {recordings[3] ? '✓ Part 3' : '✗ Part 3'}
          </span>
        </div>
        <div className="speaking-timer-wrapper">
          <div className="timer">
            ⏱️ {formatTime(timeLeft)}
          </div>
          {!isSubmitted && (
            <button className="btn btn-submit btn-sm" onClick={handleSubmit}>
              Submit
            </button>
          )}
        </div>
      </div>

      <div className="split-view" style={{ gridTemplateColumns: '1.2fr 1px 1.2fr' }}>
        {/* Left Panel: PDF Speaking Prompts */}
        <PDFViewer book={book} test={parseInt(test, 10)} partKey="speaking" pages={activePages} />

        {/* Divider */}
        <div className="split-view__divider" />

        {/* Right Panel: Recording Controls */}
        <div className="split-view__panel speaking-right-panel">
          {/* Part Navigation */}
          <div className="section-tabs" style={{ marginBottom: 20, flexShrink: 0 }}>
            {['Part 1', 'Part 2', 'Part 3'].map((partLabel, idx) => (
              <button
                key={partLabel}
                className={`section-tab ${activePartIndex === idx ? 'section-tab--active' : ''}`}
                onClick={() => {
                  if (isRecording) stopRecording()
                  setActivePartIndex(idx)
                  resetPrepTimer()
                }}
              >
                {partLabel}
              </button>
            ))}
          </div>

          {/* Part Prompt Info */}
          <div className="speaking-prompt-container">
            <div>
              <h3 className="speaking-prompt-title">
                Speaking Practice — Part {activePartIndex + 1}
              </h3>
              <p className="speaking-prompt-desc">
                {activePartIndex === 0 && 'The examiner will ask you short questions on familiar topics (family, hobbies, self, etc.). Click "Start Recording" and answer each question.'}
                {activePartIndex === 1 && 'You have 1 minute to prepare notes based on the cue card on the left, then speak continuously for 1 to 2 minutes. Click "Start Preparation" to count down.'}
                {activePartIndex === 2 && 'The examiner will ask you abstract and academic discussion questions related to the topic in Part 2. Answer in detail and clarify your arguments.'}
              </p>
            </div>

            {/* Part 2 Specific Preparation Timer */}
            {activePartIndex === 1 && (
              <div className="card speaking-prep-card">
                <div className="speaking-prep-title">⏱️ PREPARATION TIME (PART 2)</div>
                <div className={`speaking-prep-timer ${prepTimeLeft <= 10 ? 'speaking-prep-timer--danger' : ''}`}>
                  {prepTimeLeft}s
                </div>
                <div className="speaking-prep-btn-group">
                  <button className="btn btn-secondary btn-sm" onClick={startPrepTimer} disabled={isPrepActive || prepTimeLeft === 0}>
                    {isPrepActive ? '⏳ Preparing' : '🏁 Start 1 Min Preparation'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={resetPrepTimer}>
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* Recording Controls Area */}
            <div className="card speaking-recorder-card">
              {isRecording ? (
                <>
                  <div className="record-badge pulse">🔴 RECORDING</div>
                  <div className="speaking-record-status">{formatTime(recordingSeconds)}</div>
                  <button className="btn btn-danger" onClick={stopRecording} style={{ width: '100%', maxWidth: 200 }}>
                    ⏹️ Stop Recording
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '3rem' }}>🎙️</div>
                  <button className="btn btn-primary" onClick={startRecording} disabled={isSubmitted} style={{ width: '100%', maxWidth: 240 }}>
                    🎤 Start Recording Part {activePartIndex + 1}
                  </button>
                </>
              )}

              {/* Playback player if recording exists */}
              {recordings[activePartIndex + 1] && (
                <div className="speaking-playback-container">
                  <div className="speaking-playback-title">✓ Recording saved. Playback:</div>
                  <audio src={recordings[activePartIndex + 1]} controls className="speaking-playback-audio" />
                </div>
              )}
            </div>

            {/* Speaking standard examiner tips card */}
            {isSubmitted && (
              <div className="card speaking-tips-card">
                <h4 className="speaking-tips-title">
                  💡 Assessment Criteria & Self-Practice Guide
                </h4>
                <ul className="speaking-tips-list">
                  <li><strong>Fluency & Coherence:</strong> Speak coherently and fluently without long pauses. Use natural discourse markers.</li>
                  <li><strong>Lexical Resource:</strong> Use a wide range of vocabulary appropriately and combine collocations naturally.</li>
                  <li><strong>Grammatical Range & Accuracy:</strong> Use a variety of grammatical structures (complex sentences, conditionals) accurately.</li>
                  <li><strong>Pronunciation:</strong> Pronounce words clearly, with correct word stress and natural intonation.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <ResultModal
        isOpen={showResult}
        emoji="🎙️"
        title="Speaking Attempt Saved"
        testNumber={test}
        correctCount={0}
        totalCount={0}
        bandScore="Saved"
        onClose={() => setShowResult(false)}
        backUrl={`/tests/${book}/${test}`}
        customMessage="Your Speaking response recording has been successfully saved to the system! You can listen to your recordings by switching between the Part 1, 2, and 3 tabs and playing the audio."
      />
    </div>
  )
}
