"use client"

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Question = {
  question_number: number
  answer_text: string
}

type Section = {
  name: string
  rows: Question[]
}

type PracticeLayout = {
  listening: Array<{ section: number; pages: number[] }>
  reading: Array<{ passage: number; pages: number[] }>
}

const backend = 'http://127.0.0.1:8000'

export default function PracticePage() {
  const params = useParams<{ test: string }>()
  const router = useRouter()
  const test = params?.test ?? '1'

  const [sections, setSections] = useState<Section[]>([])
  const [layout, setLayout] = useState<PracticeLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [result, setResult] = useState<{ total: number; correct: number } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [testResponse, layoutResponse] = await Promise.all([
          fetch(`${backend}/api/tests/11/${test}`, { cache: 'no-store' }),
          fetch(`${backend}/api/tests/11/${test}/practice`, { cache: 'no-store' }),
        ])

        if (!testResponse.ok) throw new Error('load test failed')
        const testData = await testResponse.json()
        if (!cancelled) {
          setSections(testData.sections || [])
          const initialAnswers: Record<number, string> = {}
          for (const section of testData.sections || []) {
            for (const row of section.rows || []) {
              initialAnswers[row.question_number] = ''
            }
          }
          setAnswers(initialAnswers)
        }

        if (layoutResponse.ok && !cancelled) {
          setLayout(await layoutResponse.json())
        }

        const attemptResponse = await fetch(`${backend}/api/attempts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book: 11, test: Number(test), skill: 'reading' }),
        })
        const attemptData = await attemptResponse.json()
        if (!cancelled) setAttemptId(attemptData.id)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [test])

  const totalQuestions = useMemo(() => sections.reduce((sum, section) => sum + (section.rows?.length || 0), 0), [sections])

  async function handleSubmit() {
    if (!attemptId) return

    const responses = Object.entries(answers).map(([question_number, answer]) => ({
      question_number: Number(question_number),
      answer,
    }))

    const response = await fetch(`${backend}/api/attempts/${attemptId}/submit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responses }),
    })

    const data = await response.json()
    setResult(data.result)
  }

  if (loading) return <div>Loading practice mode...</div>

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section>
        <h2>Practice Mode - Test {test}</h2>
        <p>{totalQuestions} questions loaded from backend.</p>
        <p>
          <button onClick={() => router.push(`/tests/${test}/reading`)} style={{ marginRight: 8 }}>View Reading</button>
          <button onClick={() => router.push(`/tests/${test}/listening`)}>View Listening</button>
        </p>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16 }}>
        <h3>Listening</h3>
        {(layout?.listening || []).map((part) => (
          <div key={part.section} style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #eee' }}>
            <h4>Section {part.section}</h4>
            <audio controls preload="none" style={{ width: '100%', marginBottom: 12 }}>
              <source src={`${backend}/api/audio/IELTS11_Test${test}_Section${part.section}.mp3`} type="audio/mpeg" />
            </audio>
            <div style={{ display: 'grid', gap: 12 }}>
              {part.pages.map((pageNumber) => (
                <img key={pageNumber} src={`${backend}/api/pdf-pages/${pageNumber}.png`} alt={`Listening Section ${part.section} page ${pageNumber}`} style={{ width: '100%', border: '1px solid #ccc', borderRadius: 6 }} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16 }}>
        <h3>Reading</h3>
        {(layout?.reading || []).map((passage) => (
          <div key={passage.passage} style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #eee' }}>
            <h4>Passage {passage.passage}</h4>
            <div style={{ display: 'grid', gap: 12 }}>
              {passage.pages.map((pageNumber) => (
                <img key={pageNumber} src={`${backend}/api/pdf-pages/${pageNumber}.png`} alt={`Reading Passage ${passage.passage} page ${pageNumber}`} style={{ width: '100%', border: '1px solid #ccc', borderRadius: 6 }} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gap: 16 }}>
        {sections.map((section) => (
          <section key={section.name} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
            <h3>{section.name}</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {section.rows.map((question) => (
                <label key={question.question_number} style={{ display: 'grid', gap: 4 }}>
                  <span>Question {question.question_number}</span>
                  <input
                    type="text"
                    value={answers[question.question_number] ?? ''}
                    onChange={(event) => setAnswers((prev) => ({ ...prev, [question.question_number]: event.target.value }))}
                    placeholder="Type your answer"
                    style={{ padding: 8, border: '1px solid #bbb', borderRadius: 6 }}
                  />
                </label>
              ))}
            </div>
          </section>
        ))}
      </section>

      <div>
        <button onClick={handleSubmit} style={{ padding: '10px 16px' }}>Submit answers</button>
      </div>

      {result && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #9ad', borderRadius: 8 }}>
          <strong>Result:</strong> {result.correct}/{result.total} correct
        </div>
      )}
    </div>
  )
}
