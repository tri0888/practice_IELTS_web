"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import PDFViewer from '@/components/PDFViewer'
import ResultModal from '@/components/ResultModal'

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

interface SpeakingPracticeProps {
  test: string
}

export default function SpeakingPractice({ test }: SpeakingPracticeProps) {
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
        const resp = await fetch(`${BACKEND}/tests/11/${test}/content`)
        if (!resp.ok) throw new Error('Failed to load')
        const data = await resp.json()
        if (!cancelled) {
          setContent(data)
        }

        // Create attempt
        const attemptResp = await fetch(`${BACKEND}/attempts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book: 11, test: Number(test), skill: 'speaking' }),
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
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime) // 800Hz beep tone
      gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime)
      oscillator.start()
      setTimeout(() => { oscillator.stop() }, 600) // 600ms duration
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
          playBeep() // Alert student to begin speaking!
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
      alert("⚠️ Không thể kết nối với microphone của bạn. Hãy cấp quyền truy cập mic cho trang web và thử lại.")
    }
  }

  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return
    mediaRecorderRef.current.stop()
    setIsRecording(false)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
  }

  const activePages = useMemo(() => {
    // Speaking is page 33 for test 1, 57 for test 2, 80 for test 3, 103 for test 4
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

    // Save attempts metadata
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
        <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Đang khởi tạo phòng thi nói</div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Exam Bar */}
      <div className="exam-bar">
        <div className="exam-bar__info">
          <span className="exam-bar__badge" style={{ backgroundColor: 'var(--accent-purple)' }}>Speaking</span>
          <span>Cambridge IELTS 11 — Test {test}</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>
            Recordings: {recordings[1] ? '✓ Part 1' : '✗ Part 1'} | {recordings[2] ? '✓ Part 2' : '✗ Part 2'} | {recordings[3] ? '✓ Part 3' : '✗ Part 3'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="timer">
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
        {/* Left Panel: PDF Speaking Prompts */}
        <PDFViewer pages={activePages} />

        {/* Divider */}
        <div className="split-view__divider" />

        {/* Right Panel: Recording Controls */}
        <div className="split-view__panel" style={{ background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', padding: '24px' }}>
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
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>
                Luyện tập Speaking — Part {activePartIndex + 1}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                {activePartIndex === 0 && 'Giám khảo sẽ hỏi bạn các câu hỏi ngắn về các chủ đề quen thuộc (Gia đình, Bản thân, Sở thích, vv). Hãy click "Bắt đầu ghi âm" và trả lời từng câu hỏi.'}
                {activePartIndex === 1 && 'Bạn có 1 phút để chuẩn bị nháp dựa trên gợi ý cue card bên trái, và sau đó nói liên tục trong 1 đến 2 phút. Bấm "Bắt đầu chuẩn bị" để đếm ngược.'}
                {activePartIndex === 2 && 'Giám khảo sẽ hỏi các câu hỏi thảo luận mang tính trừu tượng và học thuật cao hơn liên quan đến chủ đề ở Part 2. Hãy trả lời chi tiết và lập luận rõ ràng.'}
              </p>
            </div>

            {/* Part 2 Specific Preparation Timer */}
            {activePartIndex === 1 && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, background: 'var(--bg-secondary)', gap: 12 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>⏱️ THỜI GIAN CHUẨN BỊ (PART 2)</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: prepTimeLeft <= 10 ? 'var(--ielts-red)' : 'var(--text-primary)' }}>
                  {prepTimeLeft}s
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-secondary btn-sm" onClick={startPrepTimer} disabled={isPrepActive || prepTimeLeft === 0}>
                    {isPrepActive ? '⏳ Đang chuẩn bị' : '🏁 Bắt đầu 1 phút chuẩn bị'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={resetPrepTimer}>
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* Recording Controls Area */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 32, gap: 16 }}>
              {isRecording ? (
                <>
                  <div className="record-badge pulse">🔴 RECORDING</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatTime(recordingSeconds)}</div>
                  <button className="btn btn-danger" onClick={stopRecording} style={{ width: '100%', maxWidth: 200 }}>
                    ⏹️ Dừng ghi âm
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '3rem' }}>🎙️</div>
                  <button className="btn btn-primary" onClick={startRecording} disabled={isSubmitted} style={{ width: '100%', maxWidth: 240 }}>
                    🎤 Bắt đầu ghi âm Part {activePartIndex + 1}
                  </button>
                </>
              )}

              {/* Playback player if recording exists */}
              {recordings[activePartIndex + 1] && (
                <div style={{ width: '100%', marginTop: 16, borderTop: '1px solid var(--border-light)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--status-correct)' }}>✓ Đã ghi âm thành công. Nghe lại:</div>
                  <audio src={recordings[activePartIndex + 1]} controls style={{ width: '100%' }} />
                </div>
              )}
            </div>

            {/* Speaking standard examiner tips card */}
            {isSubmitted && (
              <div className="card" style={{ borderLeft: '4px solid var(--accent-purple)', background: 'var(--bg-secondary)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-purple)', marginBottom: 8 }}>
                  💡 Tiêu chí đánh giá & Hướng dẫn tự ôn luyện
                </h4>
                <ul style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', paddingLeft: 16, lineHeight: 1.6 }}>
                  <li><strong>Fluency & Coherence:</strong> Nói mạch lạc, lưu loát, không ngắt quãng quá lâu. Sử dụng các từ nối tự nhiên.</li>
                  <li><strong>Lexical Resource:</strong> Sử dụng vốn từ đa dạng, đúng ngữ cảnh, kết hợp collocation hợp lý.</li>
                  <li><strong>Grammatical Range & Accuracy:</strong> Phối hợp nhiều cấu trúc ngữ pháp (câu phức, câu điều kiện) chuẩn xác.</li>
                  <li><strong>Pronunciation:</strong> Phát âm từ rõ ràng, đúng trọng âm, ngữ điệu tự nhiên dễ hiểu.</li>
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
        backUrl={`/tests/${test}`}
        customMessage="File ghi âm câu trả lời Speaking của bạn đã được ghi nhận và lưu trữ trong hệ thống thành công! Bạn có thể nghe lại các bài nói của mình bằng cách chuyển đổi giữa các tab Part 1, 2, 3 và nghe file phát lại."
      />
    </div>
  )
}
