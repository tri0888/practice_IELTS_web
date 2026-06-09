"use client"

import { useParams } from 'next/navigation'
import SpeakingPractice from '@/components/practice/SpeakingPractice'

export default function SpeakingPracticePage() {
  const params = useParams<{ book: string; test: string }>()
  const book = params?.book ?? '11'
  const test = params?.test ?? '1'

  return <SpeakingPractice book={book} test={test} />
}
