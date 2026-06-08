"use client"

import { useParams } from 'next/navigation'
import SpeakingPractice from '@/components/practice/SpeakingPractice'

export default function SpeakingPracticePage() {
  const params = useParams<{ test: string }>()
  const test = params?.test ?? '1'

  return <SpeakingPractice test={test} />
}
