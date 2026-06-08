"use client"
import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ListeningRedirect() {
  const params = useParams<{ test: string }>()
  const router = useRouter()
  const test = params?.test ?? '1'

  useEffect(() => {
    router.replace(`/tests/${test}/practice/listening`)
  }, [test, router])

  return (
    <div className="container" style={{ textAlign: 'center', paddingTop: 60 }}>
      <p>Redirecting to Listening Practice...</p>
    </div>
  )
}
