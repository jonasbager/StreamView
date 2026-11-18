import { auth } from '@clerk/nextjs/server'
import { Landing } from '@/components/Landing'

export default async function Home() {
  const { userId } = await auth()
  return <Landing userId={userId} />
}
