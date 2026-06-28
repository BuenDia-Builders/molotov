/**
 * Event poller for the Molotov indexer.
 *
 * pollOnce() fetches all events since the last stored cursor, applies each
 * event to Supabase via the SECURITY DEFINER apply_* functions, and advances
 * the cursor atomically.  Call it on a cron schedule or in a long-running loop.
 *
 * Idempotency: apply_* functions use ON CONFLICT DO NOTHING / CTE gating.
 * Re-running the same batch yields the same DB state.
 *
 * Reconstructability: truncate all tables, reset cursor to 0, run pollOnce()
 * from the deploy ledger → identical projection.
 */

import {
  rpc,
  xdr,
  scValToNative,
  Contract,
  TransactionBuilder,
  Account,
  Networks,
} from '@stellar/stellar-sdk'
import { createClient } from '@supabase/supabase-js'
import {
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  RPC_URL,
  NETWORK_PASSPHRASE,
  NFT_ID,
  CONTRACT_IDS,
  POLL_LIMIT,
  START_LEDGER,
} from './config'
import { decodeEvent } from './decode'
import type { DecodedEvent } from './decode'

// ── clients ───────────────────────────────────────────────────────────────────

const server = new rpc.Server(RPC_URL, { allowHttp: false })

// service_role client bypasses RLS — used only server-side inside this worker.
const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

// ── cursor helpers ─────────────────────────────────────────────────────────────

async function getCursor(): Promise<{ lastLedger: number; lastCursor: string | null }> {
  const { data, error } = await db
    .from('indexer_cursor')
    .select('last_ledger, last_cursor')
    .eq('id', 1)
    .single()
  if (error) throw new Error(`getCursor: ${error.message}`)
  return { lastLedger: (data as { last_ledger: number; last_cursor: string | null }).last_ledger, lastCursor: (data as { last_ledger: number; last_cursor: string | null }).last_cursor }
}

async function advanceCursor(lastLedger: number, lastCursor: string | null) {
  const { error } = await db.rpc('advance_cursor', {
    p_last_ledger: lastLedger,
    p_last_cursor: lastCursor,
  })
  if (error) throw new Error(`advanceCursor: ${error.message}`)
}

// ── token_uri hydration ───────────────────────────────────────────────────────
// MintedEvent does not carry token_uri; fetch it from the contract via simulation.

async function fetchTokenUri(tokenId: number): Promise<string> {
  try {
    const contract = new Contract(NFT_ID)
    // Any account works as source for a read-only simulation.
    const account = new Account(
      'GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM',
      '0',
    )
    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('token_uri', xdr.ScVal.scvU32(tokenId)))
      .setTimeout(30)
      .build()

    const sim = await server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      console.warn(`[poller] token_uri(${tokenId}) sim error: ${sim.error}`)
      return ''
    }
    const retval = (sim as rpc.Api.SimulateTransactionSuccessResponse).result?.retval
    if (!retval) return ''
    return scValToNative(retval) as string
  } catch (e) {
    console.warn(`[poller] fetchTokenUri(${tokenId}) failed:`, e)
    return ''
  }
}

// ── event application ─────────────────────────────────────────────────────────

async function applyDecoded(
  ev: DecodedEvent,
  meta: { ledger: number; txHash: string; eventIndex: number },
): Promise<void> {
  const { ledger, txHash, eventIndex } = meta

  switch (ev.kind) {
    case 'ArtistRegistered': {
      const { error } = await db.rpc('apply_artist_registered', {
        p_artist: ev.artist,
        p_ledger: ledger,
        p_tx: txHash,
        p_event_index: eventIndex,
      })
      if (error) throw new Error(`apply_artist_registered: ${error.message}`)
      break
    }

    case 'ArtistRevoked': {
      const { error } = await db.rpc('apply_artist_revoked', {
        p_artist: ev.artist,
        p_ledger: ledger,
        p_tx: txHash,
        p_event_index: eventIndex,
      })
      if (error) throw new Error(`apply_artist_revoked: ${error.message}`)
      break
    }

    case 'MintedEvent': {
      const tokenUri = await fetchTokenUri(ev.tokenId)
      const { error } = await db.rpc('apply_minted_event', {
        p_token_id: ev.tokenId,
        p_artist: ev.artist,
        p_owner: ev.recipient,
        p_token_uri: tokenUri,
        p_royalty_bps: ev.royaltyBps,
        p_recipients_count: ev.recipientsCount,
        p_ledger: ledger,
        p_tx: txHash,
        p_event_index: eventIndex,
      })
      if (error) throw new Error(`apply_minted_event: ${error.message}`)
      break
    }

    case 'Transfer': {
      const { error } = await db.rpc('apply_transfer', {
        p_token_id: ev.tokenId,
        p_from: ev.from,
        p_to: ev.to,
        p_ledger: ledger,
        p_tx: txHash,
        p_event_index: eventIndex,
      })
      if (error) throw new Error(`apply_transfer: ${error.message}`)
      break
    }

    case 'Burn': {
      const { error } = await db.rpc('apply_burn', {
        p_token_id: ev.tokenId,
        p_from: ev.from,
        p_ledger: ledger,
        p_tx: txHash,
        p_event_index: eventIndex,
      })
      if (error) throw new Error(`apply_burn: ${error.message}`)
      break
    }

    case 'ListingCreated': {
      const { error } = await db.rpc('apply_listing_created', {
        p_listing_id: Number(ev.listingId),
        p_nft_contract: ev.nft,
        p_seller: ev.seller,
        p_token_id: ev.tokenId,
        p_price: ev.price,
        p_currency: ev.currency,
        p_kind: ev.listingKind,
        p_editions_total: ev.editionsTotal,
        p_ends_at: Number(ev.endsAt),
        p_referral_bps: ev.referralBps,
        p_primary_split: ev.primarySplit ? JSON.stringify(ev.primarySplit) : null,
        p_ledger: ledger,
        p_tx: txHash,
        p_event_index: eventIndex,
      })
      if (error) throw new Error(`apply_listing_created: ${error.message}`)
      break
    }

    case 'Sold': {
      const { error } = await db.rpc('apply_sold', {
        p_ledger: ledger,
        p_tx: txHash,
        p_event_index: eventIndex,
        p_listing_id: Number(ev.listingId),
        p_token_id: ev.tokenId,
        p_buyer: ev.buyer,
        p_seller: ev.seller,
        p_price: ev.price,
        p_currency: ev.currency,
        p_royalty_paid: ev.royaltyPaid,
        p_referral_paid: ev.referralPaid,
        p_fee_paid: ev.feePaid,
      })
      if (error) throw new Error(`apply_sold: ${error.message}`)
      break
    }

    case 'ListingCancelled': {
      const { error } = await db.rpc('apply_listing_cancelled', {
        p_listing_id: Number(ev.listingId),
      })
      if (error) throw new Error(`apply_listing_cancelled: ${error.message}`)
      break
    }

    case 'Unknown':
      // Silently skip events we don't handle (approve, ownership_transfer, etc.)
      break
  }
}

// ── oldest-ledger discovery ───────────────────────────────────────────────────

async function resolveOldestLedger(): Promise<number> {
  try {
    // getEvents returns oldestLedger in the RetentionState base of the response.
    const probe = await server.getEvents({
      filters: [],
      startLedger: 1,
      limit: 1,
    })
    return (probe as unknown as { oldestLedger?: number }).oldestLedger ?? 1
  } catch (err: unknown) {
    // Error message: "startLedger must be within the ledger range: <min> - <max>"
    const msg = (err as { message?: string })?.message ?? ''
    const m = msg.match(/ledger range:\s*(\d+)/)
    if (m) return Number(m[1])
    const latest = await server.getLatestLedger()
    return Math.max(1, latest.sequence - 100_000)
  }
}

// ── poll loop ─────────────────────────────────────────────────────────────────

export interface PollResult {
  processedEvents: number
  latestLedger: number
  cursor: string | null
}

export async function pollOnce(): Promise<PollResult> {
  const { lastLedger, lastCursor } = await getCursor()

  // Determine the RPC start position.
  // If we have a cursor, continue pagination from there.
  // If not, compute startLedger: use env override, explicit last_ledger, or
  // fall back to (latestLedger - 100 000) to cover ~week of testnet history.
  let startOpts: { cursor: string } | { startLedger: number }
  if (lastCursor) {
    startOpts = { cursor: lastCursor }
  } else {
    // Always clamp to the oldest ledger the RPC still has: if the indexer was
    // idle for >7 days, lastLedger is before the retention window and we must
    // start from whatever the RPC can actually serve.
    const oldestRetained = await resolveOldestLedger()
    const desired = lastLedger || START_LEDGER || 0
    startOpts = { startLedger: Math.max(desired, oldestRetained) }
  }

  let totalEvents = 0
  let latestLedger = 0
  let currentCursor: string | null = lastCursor

  // Per-(ledger, txHash) counter for stable event_index assignment.
  // The RPC returns events in ledger order → tx order → event order.
  const txEventCount = new Map<string, number>()

  // The Soroban RPC has a per-call scan limit: when no matching events exist in
  // the scanned range it returns 0 events with an ADVANCING cursor. We must
  // continue through those empty pages. The true tip is when the cursor stops
  // moving (two consecutive calls return the same cursor string).
  let prevCursor: string | null = null

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await server.getEvents({
      filters: [{ type: 'contract', contractIds: [...CONTRACT_IDS] }],
      ...startOpts,
      limit: POLL_LIMIT,
    })

    latestLedger = result.latestLedger

    for (const raw of result.events) {
      if (!raw.inSuccessfulContractCall) continue

      // Stable event_index: count of events seen before this one in the same tx.
      const txKey = `${raw.ledger}:${raw.txHash}`
      const eventIndex = txEventCount.get(txKey) ?? 0
      txEventCount.set(txKey, eventIndex + 1)

      const decoded = decodeEvent(raw)
      try {
        await applyDecoded(decoded, {
          ledger: raw.ledger,
          txHash: raw.txHash,
          eventIndex,
        })
      } catch (err) {
        console.error('[poller] failed to apply event', {
          ledger: raw.ledger,
          txHash: raw.txHash,
          eventIndex,
          kind: decoded.kind,
          err,
        })
      }
    }

    totalEvents += result.events.length
    // result.cursor points just past the last returned event (SDK contract).
    if (result.cursor) currentCursor = result.cursor

    // Cursor unchanged → RPC has no more ledgers to scan, we are at the tip.
    if (result.cursor === prevCursor) break
    // Partial non-empty page → all remaining events returned, nothing ahead.
    if (result.events.length > 0 && result.events.length < POLL_LIMIT) break

    prevCursor = result.cursor ?? prevCursor
    startOpts = { cursor: result.cursor }
  }

  await advanceCursor(latestLedger || lastLedger, currentCursor)

  return { processedEvents: totalEvents, latestLedger, cursor: currentCursor }
}
