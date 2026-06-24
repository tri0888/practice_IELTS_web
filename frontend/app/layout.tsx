import './globals.css'
import AppLayout from '@/components/AppLayout/AppLayout'

export const metadata = {
  title: 'Cambridge Practice Hub',
  description: 'Practice IELTS and TOEIC tests with authentic content and real simulation interface.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  )
}
