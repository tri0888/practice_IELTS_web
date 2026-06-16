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
        <Link href="/">Test Library</Link>
        <span className="practice-hub-breadcrumb-sep">›</span>
        <Link href={`/tests/${book}/${test}`}>Test {test}</Link>
        <span className="practice-hub-breadcrumb-sep">›</span>
        <span className="practice-hub-breadcrumb-active">Chọn kỹ năng</span>
      </div>

      <h1 className="page-title">Chọn kỹ năng luyện tập</h1>
      <p className="page-subtitle">Cambridge IELTS {book} — Test {test}</p>

      <div className="practice-hub-grid">
        {/* Listening */}
        <Link href={`/tests/${book}/${test}/practice/listening`} className="practice-hub-card-link">
          <div className="card practice-hub-card">
            <div className="practice-hub-card__emoji">🎧</div>
            <h3 className="practice-hub-card__title">Listening</h3>
            <p className="practice-hub-card__desc">
              40 câu hỏi • 30 phút • 4 sections
            </p>
            <div className="btn btn-primary" style={{ width: '100%' }}>Bắt đầu</div>
          </div>
        </Link>

        {/* Reading */}
        <Link href={`/tests/[book]/[test]/practice/reading`} style={{ display: 'none' }} /> {/* dummy just for next.js path generation warning safeguard */}
        <Link href={`/tests/${book}/${test}/practice/reading`} className="practice-hub-card-link">
          <div className="card practice-hub-card">
            <div className="practice-hub-card__emoji">📖</div>
            <h3 className="practice-hub-card__title">Reading</h3>
            <p className="practice-hub-card__desc">
              40 câu hỏi • 60 phút • 3 passages
            </p>
            <div className="btn btn-primary" style={{ width: '100%' }}>Bắt đầu</div>
          </div>
        </Link>

        {/* Writing */}
        <Link href={`/tests/${book}/${test}/practice/writing`} className="practice-hub-card-link">
          <div className="card practice-hub-card">
            <div className="practice-hub-card__emoji">✍️</div>
            <h3 className="practice-hub-card__title">Writing</h3>
            <p className="practice-hub-card__desc">
              2 tasks • 60 phút
            </p>
            <div className="btn btn-primary" style={{ width: '100%' }}>Bắt đầu</div>
          </div>
        </Link>

        {/* Speaking */}
        <Link href={`/tests/${book}/${test}/practice/speaking`} className="practice-hub-card-link">
          <div className="card practice-hub-card">
            <div className="practice-hub-card__emoji">🎙️</div>
            <h3 className="practice-hub-card__title">Speaking</h3>
            <p className="practice-hub-card__desc">
              3 parts • 11-14 phút
            </p>
            <div className="btn btn-primary" style={{ width: '100%' }}>Bắt đầu</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
