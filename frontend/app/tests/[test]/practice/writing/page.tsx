"use client"

import { useParams } from 'next/navigation'
import WritingPractice from '@/components/practice/WritingPractice'

export default function WritingPracticePage() {
  const params = useParams<{ test: string }>()
  const test = params?.test ?? '1'

  return <WritingPractice test={test} />
}
