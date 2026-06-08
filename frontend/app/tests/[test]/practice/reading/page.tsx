"use client"

import { useParams } from 'next/navigation'
import ReadingPractice from '@/components/practice/ReadingPractice'

export default function ReadingPracticePage() {
  const params = useParams<{ test: string }>()
  const test = params?.test ?? '1'

  return <ReadingPractice test={test} />
}
