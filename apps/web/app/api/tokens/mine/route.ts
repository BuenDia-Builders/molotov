import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

  const { data, error } = await db
    .from('token_effective_owner')
    .select('token_id, token_uri, owner, artist, royalty_bps, effective_owner, active_listing_id')
    .or(`effective_owner.eq.${wallet},artist.eq.${wallet}`)
    .order('token_id', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json([])

  // Fetch prices for any active listings
  const listingIds = data
    .map((t) => t.active_listing_id)
    .filter((id): id is string => id != null)

  let priceMap: Record<string, string> = {}
  if (listingIds.length > 0) {
    const { data: listings } = await db
      .from('listings')
      .select('listing_id, price')
      .in('listing_id', listingIds)
    if (listings) {
      for (const l of listings) {
        priceMap[l.listing_id] = (BigInt(l.price) / 10_000_000n).toString()
      }
    }
  }

  const result = data.map((t) => ({
    ...t,
    price_xlm: t.active_listing_id ? priceMap[t.active_listing_id] : undefined,
  }))

  return NextResponse.json(result)
}
