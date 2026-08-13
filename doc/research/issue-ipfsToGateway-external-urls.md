# Issue (draft): `ipfsToGateway` returns minter-controlled non-`ipfs://` URLs verbatim

**Status:** local draft, not filed. Follow-up to the `fetchIpfs` SSRF/credential-leak
fix in `apps/web/lib/ipfs.ts`.

## Summary

`ipfsToGateway` (`apps/web/lib/ipfs.ts`) only rewrites `ipfs://` URIs to our proxy
(`/api/ipfs/<cid>`) and returns **anything else unchanged**:

```ts
export function ipfsToGateway(uri: string): string {
  return uri.startsWith("ipfs://") ? `/api/ipfs/${uri.slice("ipfs://".length)}` : uri;
}
```

The `image` field of token metadata is minter-controlled. Several server components read
it and feed it straight into an `<img src>` on the client via `ipfsToGateway`:

- `app/page.tsx:37`
- `app/token/[tokenId]/page.tsx` (`raw.image`)
- `app/works/page.tsx`, `app/artists/page.tsx`, `app/artist/[slug]/page.tsx`
- `components/featured-work.tsx`

So a token minted with `image: "https://attacker.example/x.png"` (or a tracking pixel)
becomes a direct browser image load from an arbitrary host.

## Severity: low

This is **not** the server-side credential leak that was just fixed (`fetchIpfs` no longer
sends the Pinata JWT to arbitrary hosts). It is a client-side external resource load:

- No secret is sent — it is an anonymous `GET` from the viewer's browser.
- Impact is limited to viewer IP disclosure to the attacker's host, and content served
  under our origin's `<img>` (bounded by CSP `img-src`, which today allows the IPFS
  gateways + a few explicit hosts, not arbitrary ones — so many external hosts are already
  CSP-blocked at render time).

CSP `img-src` mitigates most of it, but relying on CSP alone is not defense in depth.

## Suggested fix

Make `ipfsToGateway` only ever return our proxy path or a known-gateway URL, and return a
placeholder (or empty) for everything else — mirroring the allowlist now used in
`fetchIpfs`. Concretely: reject non-`ipfs://` inputs whose host is not in the gateway
allowlist, so `image` can never resolve to an arbitrary third party.

## Acceptance

- A token whose `image` is `https://attacker.example/...` renders the placeholder, not an
  external `<img>`.
- Legit `ipfs://<cid>` and known-gateway URLs still resolve.
