import './globals.css'
import AppLayout from '@/components/AppLayout/AppLayout'
import { AuthProvider } from '@/components/AuthProvider/AuthProvider'

export const metadata = {
  title: 'Cambridge Practice Hub',
  description: 'Practice IELTS and TOEIC tests with authentic content and real simulation interface.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
        </AuthProvider>
      </body>
    </html>
  )
}
