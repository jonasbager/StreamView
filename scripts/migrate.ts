import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'
import { readdirSync, readFileSync } from 'node:fs'

config({ path: '.env.local' })
const sql = neon(process.env.DATABASE_URL!)

async function main() {
  await sql.query('create table if not exists _migrations (name text primary key, at timestamptz default now())')
  const done = new Set((await sql.query('select name from _migrations')).map((r) => r.name as string))
  for (const file of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue
    const statements = readFileSync(`drizzle/${file}`, 'utf8').split('--> statement-breakpoint')
    for (const s of statements) if (s.trim()) await sql.query(s)
    await sql.query('insert into _migrations (name) values ($1)', [file])
    console.log('applied', file)
  }
  console.log('migrations up to date')
}
main()
