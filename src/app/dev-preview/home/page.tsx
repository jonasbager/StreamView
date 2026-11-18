import { notFound } from 'next/navigation'
import { Landing } from '@/components/Landing'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <Landing userId={null} />
}
