import { describe, expect, it, vi, beforeEach } from 'vitest'
import { rpc } from '@stellar/stellar-sdk'
import { decodeEvent } from './decode'
import { pollOnce } from './poller'

const mocks = vi.hoisted(() => ({
  mockGetEvents: vi.fn(),
  mockGetLatestLedger: vi.fn(),
  mockDbRpc: vi.fn(),
  mockDbFrom: vi.fn(),
}))

vi.mock('@stellar/stellar-sdk', () => ({
  rpc: {
    Server: vi.fn(() => ({
      getEvents: mocks.mockGetEvents,
      getLatestLedger: mocks.mockGetLatestLedger,
    })),
    Api: { isSimulationError: vi.fn(() => false) },
  },
  xdr: { ScVal: { scvU32: vi.fn() } },
  scValToNative: vi.fn(),
  Contract: vi.fn(),
  TransactionBuilder: vi.fn(() => ({
    addOperation: vi.fn(() => ({ setTimeout: vi.fn(() => ({ build: vi.fn() })) })),
  })),
  Account: vi.fn(),
  Networks: {},
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ rpc: mocks.mockDbRpc, from: mocks.mockDbFrom })),
}))

vi.mock('./config', () => ({
  SUPABASE_URL: 'mock',
  SUPABASE_SECRET_KEY: 'mock',
  RPC_URL: 'mock',
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  NFT_ID: 'mock',
  CONTRACT_IDS: ['mock'],
  POLL_LIMIT: 200,
  START_LEDGER: 0,
}))

vi.mock('./decode', () => ({
  decodeEvent: vi.fn(),
}))

function makeEvent(overrides?: Partial<rpc.Api.EventResponse>): rpc.Api.EventResponse {
  return {
    topic: [],
    value: {} as any,
    txHash: '0xtx',
    ledger: 1001,
    inSuccessfulContractCall: true,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()

  vi.mocked(decodeEvent).mockImplementation((raw: any) => ({ kind: raw._mockKind ?? 'Unknown' }))

  // getCursor → starting position
  mocks.mockDbFrom.mockReturnValue({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({ data: { last_ledger: 1000, last_cursor: null }, error: null })),
      })),
    })),
  })

  // resolveOldestLedger probe
  mocks.mockGetEvents.mockResolvedValueOnce({
    events: [],
    latestLedger: 1001,
    cursor: null,
  })
})

describe('pollOnce per-event error isolation', () => {
  it('single bad event does not block the page', async () => {
    const events = [
      makeEvent({ txHash: '0x1', _mockKind: 'Transfer' } as any),
      makeEvent({ txHash: '0x2', _mockKind: 'ListingCreated' } as any),
      makeEvent({ txHash: '0x3', _mockKind: 'Sold' } as any),
    ]

    mocks.mockGetEvents.mockResolvedValueOnce({
      events,
      latestLedger: 1001,
      cursor: 'cursor-1',
    })

    mocks.mockDbRpc
      .mockResolvedValueOnce({ error: null }) // event 1 — apply_transfer
      .mockRejectedValueOnce(new Error('FK violation')) // event 2 — apply_listing_created → throws
      .mockResolvedValueOnce({ error: null }) // event 3 — apply_sold
      .mockResolvedValueOnce({ error: null }) // advanceCursor

    await pollOnce()

    expect(mocks.mockDbRpc).toHaveBeenCalledTimes(4)
    expect(mocks.mockDbRpc).toHaveBeenNthCalledWith(1, 'apply_transfer', expect.any(Object))
    expect(mocks.mockDbRpc).toHaveBeenNthCalledWith(2, 'apply_listing_created', expect.any(Object))
    expect(mocks.mockDbRpc).toHaveBeenNthCalledWith(3, 'apply_sold', expect.any(Object))
    expect(mocks.mockDbRpc).toHaveBeenNthCalledWith(4, 'advance_cursor', expect.any(Object))
  })

  it('error is logged with full context', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const events = [
      makeEvent({ txHash: '0x1', ledger: 1005, _mockKind: 'Transfer' } as any),
      makeEvent({ txHash: '0x2', ledger: 1005, _mockKind: 'ListingCreated' } as any),
    ]

    mocks.mockGetEvents.mockResolvedValueOnce({
      events,
      latestLedger: 1005,
      cursor: 'cursor-1',
    })

    mocks.mockDbRpc
      .mockResolvedValueOnce({ error: null })
      .mockRejectedValueOnce(new Error('FK violation'))
      .mockResolvedValueOnce({ error: null }) // advanceCursor

    await pollOnce()

    expect(consoleSpy).toHaveBeenCalledWith(
      '[poller] failed to apply event',
      expect.objectContaining({
        ledger: 1005,
        txHash: '0x2',
        eventIndex: 0,
        kind: 'ListingCreated',
      }),
    )

    consoleSpy.mockRestore()
  })

  it('cursor advances after a page with all events failing', async () => {
    const events = [
      makeEvent({ txHash: '0x1', _mockKind: 'Transfer' } as any),
      makeEvent({ txHash: '0x2', _mockKind: 'Sold' } as any),
    ]

    mocks.mockGetEvents.mockResolvedValueOnce({
      events,
      latestLedger: 1001,
      cursor: 'cursor-1',
    })

    mocks.mockDbRpc
      .mockRejectedValueOnce(new Error('err1'))
      .mockRejectedValueOnce(new Error('err2'))
      .mockResolvedValueOnce({ error: null }) // advanceCursor

    await pollOnce()

    expect(mocks.mockDbRpc).toHaveBeenCalledTimes(3)
    expect(mocks.mockDbRpc).toHaveBeenNthCalledWith(3, 'advance_cursor', expect.any(Object))
  })

  it('all-success page still works (regression)', async () => {
    const events = [
      makeEvent({ txHash: '0x1', _mockKind: 'Transfer' } as any),
      makeEvent({ txHash: '0x2', _mockKind: 'Sold' } as any),
    ]

    mocks.mockGetEvents.mockResolvedValueOnce({
      events,
      latestLedger: 1001,
      cursor: 'cursor-1',
    })

    mocks.mockDbRpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null }) // advanceCursor

    const result = await pollOnce()

    expect(result.processedEvents).toBe(2)
    expect(mocks.mockDbRpc).toHaveBeenCalledTimes(3)
    expect(mocks.mockDbRpc).toHaveBeenNthCalledWith(3, 'advance_cursor', expect.any(Object))
  })
})
