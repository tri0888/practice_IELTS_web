import './globals.css'

export const metadata = {
  title: 'IELTS Practice',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{ padding: 16, borderBottom: '1px solid #eee' }}>
          <h1>IELTS Practice (Frontend)</h1>
        </header>
        <main style={{ padding: 16 }}>{children}</main>
      </body>
    </html>
  )
}
