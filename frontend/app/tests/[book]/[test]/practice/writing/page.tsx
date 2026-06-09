"use client"

import { useParams } from 'next/navigation'
import WritingPractice from '@/components/practice/WritingPractice'

export default function WritingPracticePage() {
  const params = useParams<{ book: string; test: string }>()
  const book = params?.book ?? '11'
  const test = params?.test ?? '1'

  return <WritingPractice book={book} test={test} />
}
