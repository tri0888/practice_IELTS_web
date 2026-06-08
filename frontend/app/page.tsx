"use client"
import useSWR from 'swr'
import Link from 'next/link'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const SKILL_ICONS: Record<string, { emoji: string; color: string }> = {
  listening: { emoji: '🎧', color: '#3b82f6' },
  reading: { emoji: '📖', color: '#22c55e' },
  writing: { emoji: '✍️', color: '#f59e0b' },
  speaking: { emoji: '🎙️', color: '#8b5cf6' },
}

export default function TestLibraryPage() {
  const { data, error, isLoading } = useSWR('/api/tests', fetcher)

  return (
    <div className="container fade-in">
      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1d2e 0%, #2d3148 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '48px 40px',
        marginBottom: '32px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'rgba(200, 16, 46, 0.15)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -60,
          right: 120,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.1)',
        }} />
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px', position: 'relative' }}>
          Cambridge IELTS Practice
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1.05rem', maxWidth: 600, position: 'relative' }}>
          Luyện thi IELTS với đề thi Cambridge chính thức. Giao diện mô phỏng thi thật trên máy tính.
        </p>
        <div style={{
          display: 'flex',
          gap: '24px',
          marginTop: '24px',
          position: 'relative',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>20</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Books</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.15)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>80</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tests</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.15)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>4</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Skills</div>
          </div>
        </div>
      </div>

      {/* Book 11 Section */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Cambridge IELTS 11</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Academic • 4 Tests</p>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          color: '#991b1b',
        }}>
          ⚠️ Không thể tải danh sách bài test. Hãy đảm bảo backend đang chạy.
        </div>
      )}

      {isLoading && (
        <div className="book-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="test-card" style={{ pointerEvents: 'none' }}>
              <div className="test-card__header">
                <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: 120, height: 20 }} />
              </div>
              <div className="test-card__body">
                <div className="test-card__skills">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="skeleton" style={{ height: 36 }} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="book-grid">
          {data.map((t: any) => (
            <Link
              key={t.test_number}
              href={`/tests/${t.test_number}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="test-card slide-up" style={{ animationDelay: `${(t.test_number - 1) * 100}ms` }}>
                <div className="test-card__header">
                  <div className="test-card__book">Cambridge IELTS 11</div>
                  <div className="test-card__title">Test {t.test_number}</div>
                </div>
                <div className="test-card__body">
                  <div className="test-card__skills">
                    {Object.entries(SKILL_ICONS).map(([skill, info]) => (
                      <div key={skill} className="test-card__skill">
                        <span>{info.emoji}</span>
                        <span style={{ textTransform: 'capitalize' }}>{skill}</span>
                      </div>
                    ))}
                  </div>
                  <div className="test-card__actions">
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                      Start Test
                    </button>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
