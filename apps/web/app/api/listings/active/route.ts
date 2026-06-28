import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

  const { data, error } = await db
    .from('listings')
    .select(`
      listing_id, token_id, seller, price, currency, kind,
      editions_total, editions_sold, ends_at,
      tokens(token_uri, royalty_bps, artist)
    `)
    .eq('status', 'active')
    .order('created_ledger', { ascending: false })
    .limit(12)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
