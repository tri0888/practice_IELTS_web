"use client"
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Badge, Breadcrumb, Button, Card, Skeleton } from 'antd'
import './page.css'

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
  { key: 'listening', label: 'Listening', emoji: '🎧', duration: '30 mins', questions: 40, color: '#3b82f6', available: true },
  { key: 'reading', label: 'Reading', emoji: '📖', duration: '60 mins', questions: 40, color: '#22c55e', available: true },
  { key: 'writing', label: 'Writing', emoji: '✍️', duration: '60 mins', questions: 2, color: '#f59e0b', available: true },
  { key: 'speaking', label: 'Speaking', emoji: '🎙️', duration: '11-14 mins', questions: 3, color: '#8b5cf6', available: true },
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
      <div className="container fade-in" style={{ paddingTop: 60, maxWidth: 420 }}>
        <Skeleton active title={{ width: 200 }} paragraph={{ rows: 1, width: 300 }} />
      </div>
    )
  }

  return (
    <div className="container fade-in">
      {/* Breadcrumb */}
      <Breadcrumb
        className="breadcrumb"
        items={[
          { title: <Link href="/tests">Practice Tests</Link> },
          { title: `Cambridge IELTS ${book} — Test ${test}` },
        ]}
      />

      {/* Header */}
      <div className="test-detail-header">
        <h1 className="page-title">Test {test}</h1>
        <p className="page-subtitle">Cambridge IELTS {book} Academic</p>
      </div>

      {/* Skills Grid */}
      <div className="skills-grid">
        {SKILLS.map((skill) => (
          <Badge.Ribbon key={skill.key} text="Upcoming" color="gold" style={{ display: skill.available ? 'none' : undefined }}>
          <Card className={`skill-card ${!skill.available ? 'skill-card--unavailable' : ''}`} style={{ borderTop: `4px solid ${skill.color}` }}>
            <div className="skill-emoji">{skill.emoji}</div>
            <h3 className="skill-title">{skill.label}</h3>
            <div className="skill-stats">
              <span>⏱️ {skill.duration}</span>
              <span>📝 {skill.questions} Qs</span>
            </div>
            {skill.available ? (
              <Link href={`/tests/${book}/${test}/practice/${skill.key}`}>
                <Button type="primary" block>
                  Start Practice
                </Button>
              </Link>
            ) : (
              <Button block disabled>
                Coming Soon
              </Button>
            )}
          </Card>
          </Badge.Ribbon>
        ))}
      </div>
    </div>
  )
}
