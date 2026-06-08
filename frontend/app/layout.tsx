import './globals.css'
import Link from 'next/link'

export const metadata = {
  title: 'Cambridge IELTS Practice',
  description: 'Practice IELTS tests with authentic Cambridge content. Full Listening, Reading, Writing and Speaking support.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="ielts-header">
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="ielts-header__logo">
              <div className="ielts-header__logo-icon">IELTS</div>
              <span>Cambridge Practice</span>
            </div>
          </Link>
          <nav className="ielts-header__nav">
            <Link href="/">Test Library</Link>
            <Link href="/">Dashboard</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
