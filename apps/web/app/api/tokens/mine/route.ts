import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 })

  const { data, error } = await db
    .from('tokens')
    .select('token_id, token_uri, owner, artist, royalty_bps')
    .or(`owner.eq.${wallet},artist.eq.${wallet}`)
    .order('token_id', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
