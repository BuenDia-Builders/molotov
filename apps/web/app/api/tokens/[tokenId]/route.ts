import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ tokenId: string }> }
) {
  const params = await props.params;
  const tokenId = Number(params.tokenId)
  if (isNaN(tokenId)) return NextResponse.json({ error: 'invalid token id' }, { status: 400 })

  // If Supabase is not configured yet, return mock data for UI testing
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({
      token: {
        token_id: tokenId,
        token_uri: '/icon-512.png', // local placeholder to avoid next/image domain errors
        owner: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890XYZ',
        artist: 'GDEF1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890XYZ',
        royalty_bps: 1000, // 10%
        recipients_count: 2,
        minted_ledger: 1000
      },
      listing: {
        listing_id: 'mock-listing-1',
        price: '500000000', // 50 XLM
        currency: 'native',
        kind: 'open_edition',
        editions_total: 100,
        editions_sold: 42,
        ends_at: null
      }
    })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const [tokenRes, listingRes] = await Promise.all([
    db
      .from('tokens')
      .select('token_id, token_uri, owner, artist, royalty_bps, recipients_count, minted_ledger')
      .eq('token_id', tokenId)
      .single(),
    db
      .from('listings')
      .select('listing_id, price, currency, kind, editions_total, editions_sold, ends_at')
      .eq('token_id', tokenId)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  if (tokenRes.error) return NextResponse.json({ error: tokenRes.error.message }, { status: 404 })
  return NextResponse.json({ token: tokenRes.data, listing: listingRes.data })
}
