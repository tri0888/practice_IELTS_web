"use client"
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const BACKEND = '/api'

type SkillInfo = {
  key: string
  label: string
  emoji: string
  duration: string
  questions: number
  color: string
  available: boolean
}

const SKILLS: SkillInfo[] = [
  { key: 'listening', label: 'Listening', emoji: '🎧', duration: '30 phút', questions: 40, color: '#3b82f6', available: true },
  { key: 'reading', label: 'Reading', emoji: '📖', duration: '60 phút', questions: 40, color: '#22c55e', available: true },
  { key: 'writing', label: 'Writing', emoji: '✍️', duration: '60 phút', questions: 2, color: '#f59e0b', available: true },
  { key: 'speaking', label: 'Speaking', emoji: '🎙️', duration: '11-14 phút', questions: 3, color: '#8b5cf6', available: true },
]

export default function TestDetailPage() {
  const params = useParams<{ book: string; test: string }>()
  const book = params?.book ?? '11'
  const test = params?.test ?? '1'
  const [testData, setTestData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${BACKEND}/tests/${book}/${test}`)
      .then(r => r.json())
      .then(d => { setTestData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [book, test])

  if (loading) {
    return (
      <div className="container fade-in" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div className="skeleton" style={{ width: 200, height: 24, margin: '0 auto 16px' }} />
        <div className="skeleton" style={{ width: 300, height: 16, margin: '0 auto' }} />
      </div>
    )
  }

  return (
    <div className="container fade-in">
      {/* Breadcrumb */}
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 24 }}>
        <Link href="/">Test Library</Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <span style={{ color: 'var(--text-primary)' }}>Cambridge IELTS {book} — Test {test}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">Test {test}</h1>
        <p className="page-subtitle">Cambridge IELTS {book} Academic</p>
      </div>

      {/* Skills Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 20,
        marginBottom: 32,
      }}>
        {SKILLS.map((skill) => (
          <div key={skill.key} className="card" style={{
            opacity: skill.available ? 1 : 0.5,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {!skill.available && (
              <div style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: '#f1f5f9',
                padding: '2px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
              }}>
                Phase 1c
              </div>
            )}
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>{skill.emoji}</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>{skill.label}</h3>
            <div style={{
              display: 'flex',
              gap: 16,
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              marginBottom: 16,
            }}>
              <span>⏱️ {skill.duration}</span>
              <span>📝 {skill.questions} câu</span>
            </div>
            {skill.available ? (
              <Link href={`/tests/${book}/${test}/practice/${skill.key}`}>
                <button className="btn btn-primary" style={{ width: '100%' }}>
                  Bắt đầu luyện tập
                </button>
              </Link>
            ) : (
              <button className="btn btn-secondary" style={{ width: '100%' }} disabled>
                Sắp ra mắt
              </button>
            )}
          </div>
        ))}
      </div>


    </div>
  )
}
