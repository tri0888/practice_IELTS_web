"use client"
import { useParams } from 'next/navigation'
import Link from 'next/link'
import './page.css'

export default function PracticeHubPage() {
  const params = useParams<{ book: string; test: string }>()
  const book = params?.book ?? '11'
  const test = params?.test ?? '1'

  return (
    <div className="container fade-in">
      {/* Breadcrumb */}
      <div className="practice-hub-breadcrumb">
        <Link href="/tests">Practice Tests</Link>
        <span className="practice-hub-breadcrumb-sep">›</span>
        <Link href={`/tests/${book}/${test}`}>Test {test}</Link>
        <span className="practice-hub-breadcrumb-sep">›</span>
        <span className="practice-hub-breadcrumb-active">Select Skill</span>
      </div>

      <h1 className="page-title">Select Practice Skill</h1>
      <p className="page-subtitle">Cambridge IELTS {book} — Test {test}</p>

      <div className="practice-hub-grid">
        {/* Listening */}
        <Link href={`/tests/${book}/${test}/practice/listening`} className="practice-hub-card-link">
          <div className="card practice-hub-card">
            <div className="practice-hub-card__emoji">🎧</div>
            <h3 className="practice-hub-card__title">Listening</h3>
            <p className="practice-hub-card__desc">
              40 Questions • 30 mins • 4 Sections
            </p>
            <div className="btn btn-primary" style={{ width: '100%' }}>Start</div>
          </div>
        </Link>

        {/* Reading */}
        <Link href={`/tests/[book]/[test]/practice/reading`} style={{ display: 'none' }} /> {/* dummy just for next.js path generation warning safeguard */}
        <Link href={`/tests/${book}/${test}/practice/reading`} className="practice-hub-card-link">
          <div className="card practice-hub-card">
            <div className="practice-hub-card__emoji">📖</div>
            <h3 className="practice-hub-card__title">Reading</h3>
            <p className="practice-hub-card__desc">
              40 Questions • 60 mins • 3 Passages
            </p>
            <div className="btn btn-primary" style={{ width: '100%' }}>Start</div>
          </div>
        </Link>

        {/* Writing */}
        <Link href={`/tests/${book}/${test}/practice/writing`} className="practice-hub-card-link">
          <div className="card practice-hub-card">
            <div className="practice-hub-card__emoji">✍️</div>
            <h3 className="practice-hub-card__title">Writing</h3>
            <p className="practice-hub-card__desc">
              2 Tasks • 60 mins
            </p>
            <div className="btn btn-primary" style={{ width: '100%' }}>Start</div>
          </div>
        </Link>

        {/* Speaking */}
        <Link href={`/tests/${book}/${test}/practice/speaking`} className="practice-hub-card-link">
          <div className="card practice-hub-card">
            <div className="practice-hub-card__emoji">🎙️</div>
            <h3 className="practice-hub-card__title">Speaking</h3>
            <p className="practice-hub-card__desc">
              3 Parts • 11-14 mins
            </p>
            <div className="btn btn-primary" style={{ width: '100%' }}>Start</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
