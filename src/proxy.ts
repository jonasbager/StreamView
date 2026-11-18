import { clerkMiddleware } from '@clerk/nextjs/server'

// Auth is checked in each page, layout and server action (see src/lib/data.ts).
export default clerkMiddleware()

export const config = {
  matcher: [
    '/((?!_next|dev-preview|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
