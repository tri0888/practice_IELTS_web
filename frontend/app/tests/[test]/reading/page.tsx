"use client"
import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ReadingRedirect() {
  const params = useParams<{ test: string }>()
  const router = useRouter()
  const test = params?.test ?? '1'

  useEffect(() => {
    router.replace(`/tests/${test}/practice/reading`)
  }, [test, router])

  return (
    <div className="container" style={{ textAlign: 'center', paddingTop: 60 }}>
      <p>Redirecting to Reading Practice...</p>
    </div>
  )
}
