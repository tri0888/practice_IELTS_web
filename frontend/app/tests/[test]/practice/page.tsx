"use client"
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function PracticeHubPage() {
  const params = useParams<{ test: string }>()
  const test = params?.test ?? '1'

  return (
    <div className="container fade-in">
      {/* Breadcrumb */}
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 24 }}>
        <Link href="/">Test Library</Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <Link href={`/tests/${test}`}>Test {test}</Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <span style={{ color: 'var(--text-primary)' }}>Chọn kỹ năng</span>
      </div>

      <h1 className="page-title">Chọn kỹ năng luyện tập</h1>
      <p className="page-subtitle">Cambridge IELTS 11 — Test {test}</p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 20,
        marginTop: 24,
      }}>
        {/* Listening */}
        <Link href={`/tests/${test}/practice/listening`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎧</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>Listening</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
              40 câu hỏi • 30 phút • 4 sections
            </p>
            <div className="btn btn-primary" style={{ width: '100%' }}>Bắt đầu</div>
          </div>
        </Link>

        {/* Reading */}
        <Link href={`/tests/${test}/practice/reading`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📖</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>Reading</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
              40 câu hỏi • 60 phút • 3 passages
            </p>
            <div className="btn btn-primary" style={{ width: '100%' }}>Bắt đầu</div>
          </div>
        </Link>

        {/* Writing */}
        <Link href={`/tests/${test}/practice/writing`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>✍️</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>Writing</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
              2 tasks • 60 phút
            </p>
            <div className="btn btn-primary" style={{ width: '100%' }}>Bắt đầu</div>
          </div>
        </Link>

        {/* Speaking */}
        <Link href={`/tests/${test}/practice/speaking`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎙️</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>Speaking</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
              3 parts • 11-14 phút
            </p>
            <div className="btn btn-primary" style={{ width: '100%' }}>Bắt đầu</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
