"use client"

import { useParams } from 'next/navigation'
import ReadingPractice from '@/components/practice/ReadingPractice'

export default function ReadingPracticePage() {
  const params = useParams<{ book: string; test: string }>()
  const book = params?.book ?? '11'
  const test = params?.test ?? '1'

  return <ReadingPractice book={book} test={test} />
}
