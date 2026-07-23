import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}

export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CBS6UQE542PLU54SVUIK76EKWUJ3CNPOQ35IB4WXKF3BU6YDIBEC7XWS",
  },
} as const;

export interface RoyaltyRecipient {
  address: string;
  share_bps: u32;
}

export interface Client {
  /**
   * Construct and simulate a burn transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Burn + clean up. The base burn removes ownership; we additionally drop the
   * per-token royalty, URI, and minter entries so a burned token leaves no
   * orphaned persistent rent behind.
   */
  burn: (
    { from, token_id }: { from: string; token_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Mints a token to `recipient`, attributed to `artist`, with its IPFS URI
   * and immutable royalty config. Returns the sequential `token_id`.
   */
  mint: (
    {
      artist,
      recipient,
      token_uri,
      royalty_bps,
      recipients,
    }: {
      artist: string;
      recipient: string;
      token_uri: string;
      royalty_bps: u32;
      recipients: Array<RoyaltyRecipient>;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the token collection name.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   */
  name: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the token collection symbol.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   */
  symbol: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gives permission to `approved` to transfer the token with `token_id` to
   * another account. The approval is cleared when the token is
   * transferred.
   *
   * Only a single account can be approved at a time for a `token_id`.
   * To remove an approval, the approver can approve their own address,
   * effectively removing the previous approved address. Alternatively,
   * setting the `live_until_ledger` to `0` will also revoke the approval.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `approver` - The address of the approver (should be `owner` or
   * `operator`).
   * * `approved` - The address receiving the approval.
   * * `token_id` - Token ID as a number.
   * * `live_until_ledger` - The ledger number at which the allowance
   * expires. If `live_until_ledger` is `0`, the approval is revoked.
   *
   * # Errors
   *
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   * * [`NonFungibleTokenError::InvalidApprover`] - If the owner address is
   * not the actual owner of the token.
   * * [`NonFungibleTokenError::InvalidLiveUntilLedger`] - If the ledge
   */
  approve: (
    {
      approver,
      approved,
      token_id,
      live_until_ledger,
    }: { approver: string; approved: string; token_id: u32; live_until_ledger: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the number of tokens owned by `account`.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `account` - The address for which the balance is being queried.
   */
  balance: (
    { account }: { account: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrade the contract WASM in place (SEP-49). Owner-gated.
   *
   * Same address, same data, new code. The per-token royalty config stays
   * immutable — no code path here rewrites it.
   */
  upgrade: (
    { new_wasm_hash }: { new_wasm_hash: Buffer },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a owner_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the owner of the token with `token_id`.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `token_id` - Token ID as a number.
   *
   * # Errors
   *
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   */
  owner_of: (
    { token_id }: { token_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  registry: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfers the token with `token_id` from `from` to `to`.
   *
   * WARNING: Confirmation that the recipient is capable of receiving the
   * `Non-Fungible` is the caller's responsibility; otherwise the NFT may be
   * permanently lost.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `from` - Account of the sender.
   * * `to` - Account of the recipient.
   * * `token_id` - Token ID as a number.
   *
   * # Errors
   *
   * * [`NonFungibleTokenError::IncorrectOwner`] - If the current owner
   * (before calling this function) is not `from`.
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   *
   * # Events
   *
   * * topics - `["transfer", from: Address, to: Address]`
   * * data - `[token_id: u32]`
   */
  transfer: (
    { from, to, token_id }: { from: string; to: string; token_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a burn_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  burn_from: (
    { spender, from, token_id }: { spender: string; from: string; token_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_owner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns `Some(Address)` if ownership is set, or `None` if ownership has
   * been renounced.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   */
  get_owner: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>;

  /**
   * Construct and simulate a minter_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The token's creator, or `None` for legacy tokens minted before minter
   * tracking existed. The marketplace uses this to allow a primary-sale split
   * only when the seller is the minter.
   */
  minter_of: (
    { token_id }: { token_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Option<string>>>;

  /**
   * Construct and simulate a token_uri transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Override: returns the per-token IPFS URI stored at mint (not base_uri + id).
   * Bumps the URI entry TTL on every successful read so it stays alive as long
   * as the token is queried.
   */
  token_uri: (
    { token_id }: { token_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a royalty_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  royalty_bps: (
    { token_id }: { token_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a get_approved transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the account approved for the token with `token_id`.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `token_id` - Token ID as a number.
   *
   * # Errors
   *
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   */
  get_approved: (
    { token_id }: { token_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Option<string>>>;

  /**
   * Construct and simulate a set_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Point the mint gate at a new ArtistRegistry. Owner-gated.
   *
   * Required to activate the gate (swap out the placeholder) or rotate the
   * registry without redeploying the NFT.
   */
  set_registry: (
    { new_registry }: { new_registry: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a transfer_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfers the token with `token_id` from `from` to `to` by using
   * `spender`s approval.
   *
   * Unlike `transfer()`, which is used when the token owner initiates the
   * transfer, `transfer_from()` allows an approved third party
   * (`spender`) to transfer the token on behalf of the owner. This
   * function verifies that `spender` has the necessary approval.
   *
   * WARNING: Confirmation that the recipient is capable of receiving the
   * `Non-Fungible` is the caller's responsibility; otherwise the NFT may be
   * permanently lost.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `spender` - The address authorizing the transfer.
   * * `from` - Account of the sender.
   * * `to` - Account of the recipient.
   * * `token_id` - Token ID as a number.
   *
   * # Errors
   *
   * * [`NonFungibleTokenError::IncorrectOwner`] - If the current owner
   * (before calling this function) is not `from`.
   * * [`NonFungibleTokenError::InsufficientApproval`] - If the spender does
   * not have a valid approval.
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   *
   * # Events
   */
  transfer_from: (
    { spender, from, to, token_id }: { spender: string; from: string; to: string; token_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a approve_for_all transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Approve or remove `operator` as an operator for the owner.
   *
   * Operators can call `transfer_from()` for any token held by `owner`,
   * and call `approve()` on behalf of `owner`.
   *
   * # Arguments
   *
   * * `e` - Access to Soroban environment.
   * * `owner` - The address holding the tokens.
   * * `operator` - Account to add to the set of authorized operators.
   * * `live_until_ledger` - The ledger number at which the allowance
   * expires. If `live_until_ledger` is `0`, the approval is revoked.
   *
   * # Errors
   *
   * * [`NonFungibleTokenError::InvalidLiveUntilLedger`] - If the ledger
   * number is less than the current ledger number.
   *
   * # Events
   *
   * * topics - `["approve_for_all", from: Address]`
   * * data - `[operator: Address, live_until_ledger: u32]`
   */
  approve_for_all: (
    {
      owner,
      operator,
      live_until_ledger,
    }: { owner: string; operator: string; live_until_ledger: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a accept_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Accepts a pending ownership transfer.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   *
   * # Errors
   *
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * there is no pending transfer to accept.
   *
   * # Events
   *
   * * topics - `["ownership_transfer_completed"]`
   * * data - `[new_owner: Address]`
   */
  accept_ownership: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_royalty_info transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Royalty distribution for a sale: a list of `(recipient, amount_stroops)`.
   * The marketplace consumes it to distribute proceeds.
   *
   * `total = sale_price * total_bps / 10000`; each share is
   * `total * share_bps / 10000`. The last recipient absorbs the rounding dust
   * so that the sum of amounts == total.
   */
  get_royalty_info: (
    { token_id, sale_price }: { token_id: u32; sale_price: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<readonly [string, i128]>>>;

  /**
   * Construct and simulate a set_token_royalty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_token_royalty: (
    { token_id, receiver, basis_points }: { token_id: u32; receiver: string; basis_points: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a renounce_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Renounces ownership of the contract.
   *
   * Permanently removes the owner, disabling all functions gated by
   * `#[only_owner]`.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   *
   * # Errors
   *
   * * [`OwnableError::TransferInProgress`] - If there is a pending ownership
   * transfer.
   * * [`OwnableError::OwnerNotSet`] - If the owner is not set.
   *
   * # Notes
   *
   * * Authorization for the current owner is required.
   */
  renounce_ownership: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a transfer_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initiates a 2-step ownership transfer to a new address.
   *
   * Requires authorization from the current owner. The new owner must later
   * call `accept_ownership()` to complete the transfer.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `new_owner` - The proposed new owner.
   * * `live_until_ledger` - Ledger number until which the new owner can
   * accept. A value of `0` cancels any pending transfer.
   *
   * # Errors
   *
   * * [`OwnableError::OwnerNotSet`] - If the owner is not set.
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * trying to cancel a transfer that doesn't exist.
   * * [`crate::role_transfer::RoleTransferError::InvalidLiveUntilLedger`] -
   * If the specified ledger is in the past.
   * * [`crate::role_transfer::RoleTransferError::InvalidPendingAccount`] -
   * If the specified pending account is not the same as the provided `new`
   * address.
   *
   * # Notes
   *
   * * Authorization for the current owner is required.
   */
  transfer_ownership: (
    { new_owner, live_until_ledger }: { new_owner: string; live_until_ledger: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a is_approved_for_all transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns whether the `operator` is allowed to manage all the assets of
   * `owner`.
   *
   * # Arguments
   *
   * * `e` - Access to the Soroban environment.
   * * `owner` - Account of the token's owner.
   * * `operator` - Account to be checked.
   */
  is_approved_for_all: (
    { owner, operator }: { owner: string; operator: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<boolean>>;

  /**
   * Construct and simulate a set_default_royalty transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_default_royalty: (
    { receiver, basis_points }: { receiver: string; basis_points: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;
}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    {
      admin,
      registry,
      name,
      symbol,
    }: { admin: string; registry: string; name: string; symbol: string },
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      },
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({ admin, registry, name, symbol }, options);
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAAAAAAALJCdXJuICsgY2xlYW4gdXAuIFRoZSBiYXNlIGJ1cm4gcmVtb3ZlcyBvd25lcnNoaXA7IHdlIGFkZGl0aW9uYWxseSBkcm9wIHRoZQpwZXItdG9rZW4gcm95YWx0eSwgVVJJLCBhbmQgbWludGVyIGVudHJpZXMgc28gYSBidXJuZWQgdG9rZW4gbGVhdmVzIG5vCm9ycGhhbmVkIHBlcnNpc3RlbnQgcmVudCBiZWhpbmQuAAAAAAAEYnVybgAAAAIAAAAAAAAABGZyb20AAAATAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAA",
        "AAAAAAAAAIhNaW50cyBhIHRva2VuIHRvIGByZWNpcGllbnRgLCBhdHRyaWJ1dGVkIHRvIGBhcnRpc3RgLCB3aXRoIGl0cyBJUEZTIFVSSQphbmQgaW1tdXRhYmxlIHJveWFsdHkgY29uZmlnLiBSZXR1cm5zIHRoZSBzZXF1ZW50aWFsIGB0b2tlbl9pZGAuAAAABG1pbnQAAAAFAAAAAAAAAAZhcnRpc3QAAAAAABMAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAACXRva2VuX3VyaQAAAAAAABAAAAAAAAAAC3JveWFsdHlfYnBzAAAAAAQAAAAAAAAACnJlY2lwaWVudHMAAAAAA+oAAAfQAAAAEFJveWFsdHlSZWNpcGllbnQAAAABAAAABA==",
        "AAAAAAAAAFtSZXR1cm5zIHRoZSB0b2tlbiBjb2xsZWN0aW9uIG5hbWUuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAARuYW1lAAAAAAAAAAEAAAAQ",
        "AAAAAAAAAF1SZXR1cm5zIHRoZSB0b2tlbiBjb2xsZWN0aW9uIHN5bWJvbC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4AAAAAAAAGc3ltYm9sAAAAAAAAAAAAAQAAABA=",
        "AAAAAAAABABHaXZlcyBwZXJtaXNzaW9uIHRvIGBhcHByb3ZlZGAgdG8gdHJhbnNmZXIgdGhlIHRva2VuIHdpdGggYHRva2VuX2lkYCB0bwphbm90aGVyIGFjY291bnQuIFRoZSBhcHByb3ZhbCBpcyBjbGVhcmVkIHdoZW4gdGhlIHRva2VuIGlzCnRyYW5zZmVycmVkLgoKT25seSBhIHNpbmdsZSBhY2NvdW50IGNhbiBiZSBhcHByb3ZlZCBhdCBhIHRpbWUgZm9yIGEgYHRva2VuX2lkYC4KVG8gcmVtb3ZlIGFuIGFwcHJvdmFsLCB0aGUgYXBwcm92ZXIgY2FuIGFwcHJvdmUgdGhlaXIgb3duIGFkZHJlc3MsCmVmZmVjdGl2ZWx5IHJlbW92aW5nIHRoZSBwcmV2aW91cyBhcHByb3ZlZCBhZGRyZXNzLiBBbHRlcm5hdGl2ZWx5LApzZXR0aW5nIHRoZSBgbGl2ZV91bnRpbF9sZWRnZXJgIHRvIGAwYCB3aWxsIGFsc28gcmV2b2tlIHRoZSBhcHByb3ZhbC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBhcHByb3ZlcmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgYXBwcm92ZXIgKHNob3VsZCBiZSBgb3duZXJgIG9yCmBvcGVyYXRvcmApLgoqIGBhcHByb3ZlZGAgLSBUaGUgYWRkcmVzcyByZWNlaXZpbmcgdGhlIGFwcHJvdmFsLgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KKiBgbGl2ZV91bnRpbF9sZWRnZXJgIC0gVGhlIGxlZGdlciBudW1iZXIgYXQgd2hpY2ggdGhlIGFsbG93YW5jZQpleHBpcmVzLiBJZiBgbGl2ZV91bnRpbF9sZWRnZXJgIGlzIGAwYCwgdGhlIGFwcHJvdmFsIGlzIHJldm9rZWQuCgojIEVycm9ycwoKKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6Tm9uRXhpc3RlbnRUb2tlbmBdIC0gSWYgdGhlIHRva2VuIGRvZXMgbm90CmV4aXN0LgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpJbnZhbGlkQXBwcm92ZXJgXSAtIElmIHRoZSBvd25lciBhZGRyZXNzIGlzCm5vdCB0aGUgYWN0dWFsIG93bmVyIG9mIHRoZSB0b2tlbi4KKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6SW52YWxpZExpdmVVbnRpbExlZGdlcmBdIC0gSWYgdGhlIGxlZGdlAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAIYXBwcm92ZXIAAAATAAAAAAAAAAhhcHByb3ZlZAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAA==",
        "AAAAAAAAAKtSZXR1cm5zIHRoZSBudW1iZXIgb2YgdG9rZW5zIG93bmVkIGJ5IGBhY2NvdW50YC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWRkcmVzcyBmb3Igd2hpY2ggdGhlIGJhbGFuY2UgaXMgYmVpbmcgcXVlcmllZC4AAAAAB2JhbGFuY2UAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAQ=",
        "AAAAAAAAAK1VcGdyYWRlIHRoZSBjb250cmFjdCBXQVNNIGluIHBsYWNlIChTRVAtNDkpLiBPd25lci1nYXRlZC4KClNhbWUgYWRkcmVzcywgc2FtZSBkYXRhLCBuZXcgY29kZS4gVGhlIHBlci10b2tlbiByb3lhbHR5IGNvbmZpZyBzdGF5cwppbW11dGFibGUg4oCUIG5vIGNvZGUgcGF0aCBoZXJlIHJld3JpdGVzIGl0LgAAAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAAOVSZXR1cm5zIHRoZSBvd25lciBvZiB0aGUgdG9rZW4gd2l0aCBgdG9rZW5faWRgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KCiMgRXJyb3JzCgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpOb25FeGlzdGVudFRva2VuYF0gLSBJZiB0aGUgdG9rZW4gZG9lcyBub3QKZXhpc3QuAAAAAAAACG93bmVyX29mAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAIcmVnaXN0cnkAAAAAAAAAAQAAABM=",
        "AAAAAAAAAqBUcmFuc2ZlcnMgdGhlIHRva2VuIHdpdGggYHRva2VuX2lkYCBmcm9tIGBmcm9tYCB0byBgdG9gLgoKV0FSTklORzogQ29uZmlybWF0aW9uIHRoYXQgdGhlIHJlY2lwaWVudCBpcyBjYXBhYmxlIG9mIHJlY2VpdmluZyB0aGUKYE5vbi1GdW5naWJsZWAgaXMgdGhlIGNhbGxlcidzIHJlc3BvbnNpYmlsaXR5OyBvdGhlcndpc2UgdGhlIE5GVCBtYXkgYmUKcGVybWFuZW50bHkgbG9zdC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgZnJvbWAgLSBBY2NvdW50IG9mIHRoZSBzZW5kZXIuCiogYHRvYCAtIEFjY291bnQgb2YgdGhlIHJlY2lwaWVudC4KKiBgdG9rZW5faWRgIC0gVG9rZW4gSUQgYXMgYSBudW1iZXIuCgojIEVycm9ycwoKKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6SW5jb3JyZWN0T3duZXJgXSAtIElmIHRoZSBjdXJyZW50IG93bmVyCihiZWZvcmUgY2FsbGluZyB0aGlzIGZ1bmN0aW9uKSBpcyBub3QgYGZyb21gLgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpOb25FeGlzdGVudFRva2VuYF0gLSBJZiB0aGUgdG9rZW4gZG9lcyBub3QKZXhpc3QuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJ0cmFuc2ZlciIsIGZyb206IEFkZHJlc3MsIHRvOiBBZGRyZXNzXWAKKiBkYXRhIC0gYFt0b2tlbl9pZDogdTMyXWAAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAA=",
        "AAAABQAAAERTdHJ1Y3R1cmVkIGV2ZW50IGVtaXR0ZWQgb24gbWludC4gYHRva2VuX2lkYCBpcyBhIHRvcGljIChpbmRleGFibGUpLgAAAAAAAAALTWludGVkRXZlbnQAAAAAAQAAAAxtaW50ZWRfZXZlbnQAAAAFAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAAAAAAAAZhcnRpc3QAAAAAABMAAAAAAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAAAAAALcm95YWx0eV9icHMAAAAABAAAAAAAAAAAAAAAEHJlY2lwaWVudHNfY291bnQAAAAEAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAJYnVybl9mcm9tAAAAAAAAAwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAA==",
        "AAAAAAAAAJBSZXR1cm5zIGBTb21lKEFkZHJlc3MpYCBpZiBvd25lcnNoaXAgaXMgc2V0LCBvciBgTm9uZWAgaWYgb3duZXJzaGlwIGhhcwpiZWVuIHJlbm91bmNlZC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4AAAAJZ2V0X293bmVyAAAAAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAALNUaGUgdG9rZW4ncyBjcmVhdG9yLCBvciBgTm9uZWAgZm9yIGxlZ2FjeSB0b2tlbnMgbWludGVkIGJlZm9yZSBtaW50ZXIKdHJhY2tpbmcgZXhpc3RlZC4gVGhlIG1hcmtldHBsYWNlIHVzZXMgdGhpcyB0byBhbGxvdyBhIHByaW1hcnktc2FsZSBzcGxpdApvbmx5IHdoZW4gdGhlIHNlbGxlciBpcyB0aGUgbWludGVyLgAAAAAJbWludGVyX29mAAAAAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAA+gAAAAT",
        "AAAAAAAAALBPdmVycmlkZTogcmV0dXJucyB0aGUgcGVyLXRva2VuIElQRlMgVVJJIHN0b3JlZCBhdCBtaW50IChub3QgYmFzZV91cmkgKyBpZCkuCkJ1bXBzIHRoZSBVUkkgZW50cnkgVFRMIG9uIGV2ZXJ5IHN1Y2Nlc3NmdWwgcmVhZCBzbyBpdCBzdGF5cyBhbGl2ZSBhcyBsb25nCmFzIHRoZSB0b2tlbiBpcyBxdWVyaWVkLgAAAAl0b2tlbl91cmkAAAAAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAABAAAAEA==",
        "AAAAAAAAAAAAAAALcm95YWx0eV9icHMAAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAAAQ=",
        "AAAAAAAAAPFSZXR1cm5zIHRoZSBhY2NvdW50IGFwcHJvdmVkIGZvciB0aGUgdG9rZW4gd2l0aCBgdG9rZW5faWRgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KCiMgRXJyb3JzCgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpOb25FeGlzdGVudFRva2VuYF0gLSBJZiB0aGUgdG9rZW4gZG9lcyBub3QKZXhpc3QuAAAAAAAADGdldF9hcHByb3ZlZAAAAAEAAAAAAAAACHRva2VuX2lkAAAABAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAKdQb2ludCB0aGUgbWludCBnYXRlIGF0IGEgbmV3IEFydGlzdFJlZ2lzdHJ5LiBPd25lci1nYXRlZC4KClJlcXVpcmVkIHRvIGFjdGl2YXRlIHRoZSBnYXRlIChzd2FwIG91dCB0aGUgcGxhY2Vob2xkZXIpIG9yIHJvdGF0ZSB0aGUKcmVnaXN0cnkgd2l0aG91dCByZWRlcGxveWluZyB0aGUgTkZULgAAAAAMc2V0X3JlZ2lzdHJ5AAAAAQAAAAAAAAAMbmV3X3JlZ2lzdHJ5AAAAEwAAAAA=",
        "AAAAAQAAAAAAAAAAAAAAEFJveWFsdHlSZWNpcGllbnQAAAACAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAAAAAACXNoYXJlX2JwcwAAAAAAAAQ=",
        "AAAAAAAAAKhJbml0aWFsaXplcyB0aGUgY29sbGVjdGlvbi4KCmBhZG1pbmAgaXMgdGhlIG93bmVyIE9OTFkgZm9yIHVwZ3JhZGVzIC8gdHJlYXN1cnkgY2hhbmdlcywgbmV2ZXIgdG8gdG91Y2gKcm95YWx0aWVzLiBgcmVnaXN0cnlgIGlzIHRoZSBBcnRpc3RSZWdpc3RyeSAob3IgdGhlIHBsYWNlaG9sZGVyKS4AAAANX19jb25zdHJ1Y3RvcgAAAAAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIcmVnaXN0cnkAAAATAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAGc3ltYm9sAAAAAAAQAAAAAA==",
        "AAAAAAAABABUcmFuc2ZlcnMgdGhlIHRva2VuIHdpdGggYHRva2VuX2lkYCBmcm9tIGBmcm9tYCB0byBgdG9gIGJ5IHVzaW5nCmBzcGVuZGVyYHMgYXBwcm92YWwuCgpVbmxpa2UgYHRyYW5zZmVyKClgLCB3aGljaCBpcyB1c2VkIHdoZW4gdGhlIHRva2VuIG93bmVyIGluaXRpYXRlcyB0aGUKdHJhbnNmZXIsIGB0cmFuc2Zlcl9mcm9tKClgIGFsbG93cyBhbiBhcHByb3ZlZCB0aGlyZCBwYXJ0eQooYHNwZW5kZXJgKSB0byB0cmFuc2ZlciB0aGUgdG9rZW4gb24gYmVoYWxmIG9mIHRoZSBvd25lci4gVGhpcwpmdW5jdGlvbiB2ZXJpZmllcyB0aGF0IGBzcGVuZGVyYCBoYXMgdGhlIG5lY2Vzc2FyeSBhcHByb3ZhbC4KCldBUk5JTkc6IENvbmZpcm1hdGlvbiB0aGF0IHRoZSByZWNpcGllbnQgaXMgY2FwYWJsZSBvZiByZWNlaXZpbmcgdGhlCmBOb24tRnVuZ2libGVgIGlzIHRoZSBjYWxsZXIncyByZXNwb25zaWJpbGl0eTsgb3RoZXJ3aXNlIHRoZSBORlQgbWF5IGJlCnBlcm1hbmVudGx5IGxvc3QuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHNwZW5kZXJgIC0gVGhlIGFkZHJlc3MgYXV0aG9yaXppbmcgdGhlIHRyYW5zZmVyLgoqIGBmcm9tYCAtIEFjY291bnQgb2YgdGhlIHNlbmRlci4KKiBgdG9gIC0gQWNjb3VudCBvZiB0aGUgcmVjaXBpZW50LgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KCiMgRXJyb3JzCgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpJbmNvcnJlY3RPd25lcmBdIC0gSWYgdGhlIGN1cnJlbnQgb3duZXIKKGJlZm9yZSBjYWxsaW5nIHRoaXMgZnVuY3Rpb24pIGlzIG5vdCBgZnJvbWAuCiogW2BOb25GdW5naWJsZVRva2VuRXJyb3I6Okluc3VmZmljaWVudEFwcHJvdmFsYF0gLSBJZiB0aGUgc3BlbmRlciBkb2VzCm5vdCBoYXZlIGEgdmFsaWQgYXBwcm92YWwuCiogW2BOb25GdW5naWJsZVRva2VuRXJyb3I6Ok5vbkV4aXN0ZW50VG9rZW5gXSAtIElmIHRoZSB0b2tlbiBkb2VzIG5vdApleGlzdC4KCiMgRXZlbnRzAAAADXRyYW5zZmVyX2Zyb20AAAAAAAAEAAAAAAAAAAdzcGVuZGVyAAAAABMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAA==",
        "AAAAAAAAAr9BcHByb3ZlIG9yIHJlbW92ZSBgb3BlcmF0b3JgIGFzIGFuIG9wZXJhdG9yIGZvciB0aGUgb3duZXIuCgpPcGVyYXRvcnMgY2FuIGNhbGwgYHRyYW5zZmVyX2Zyb20oKWAgZm9yIGFueSB0b2tlbiBoZWxkIGJ5IGBvd25lcmAsCmFuZCBjYWxsIGBhcHByb3ZlKClgIG9uIGJlaGFsZiBvZiBgb3duZXJgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYG93bmVyYCAtIFRoZSBhZGRyZXNzIGhvbGRpbmcgdGhlIHRva2Vucy4KKiBgb3BlcmF0b3JgIC0gQWNjb3VudCB0byBhZGQgdG8gdGhlIHNldCBvZiBhdXRob3JpemVkIG9wZXJhdG9ycy4KKiBgbGl2ZV91bnRpbF9sZWRnZXJgIC0gVGhlIGxlZGdlciBudW1iZXIgYXQgd2hpY2ggdGhlIGFsbG93YW5jZQpleHBpcmVzLiBJZiBgbGl2ZV91bnRpbF9sZWRnZXJgIGlzIGAwYCwgdGhlIGFwcHJvdmFsIGlzIHJldm9rZWQuCgojIEVycm9ycwoKKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6SW52YWxpZExpdmVVbnRpbExlZGdlcmBdIC0gSWYgdGhlIGxlZGdlcgpudW1iZXIgaXMgbGVzcyB0aGFuIHRoZSBjdXJyZW50IGxlZGdlciBudW1iZXIuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJhcHByb3ZlX2Zvcl9hbGwiLCBmcm9tOiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtvcGVyYXRvcjogQWRkcmVzcywgbGl2ZV91bnRpbF9sZWRnZXI6IHUzMl1gAAAAAA9hcHByb3ZlX2Zvcl9hbGwAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAhvcGVyYXRvcgAAABMAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAA=",
        "AAAAAAAAATBBY2NlcHRzIGEgcGVuZGluZyBvd25lcnNoaXAgdHJhbnNmZXIuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRoZXJlIGlzIG5vIHBlbmRpbmcgdHJhbnNmZXIgdG8gYWNjZXB0LgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsib3duZXJzaGlwX3RyYW5zZmVyX2NvbXBsZXRlZCJdYAoqIGRhdGEgLSBgW25ld19vd25lcjogQWRkcmVzc11gAAAAEGFjY2VwdF9vd25lcnNoaXAAAAAAAAAAAA==",
        "AAAAAAAAASVSb3lhbHR5IGRpc3RyaWJ1dGlvbiBmb3IgYSBzYWxlOiBhIGxpc3Qgb2YgYChyZWNpcGllbnQsIGFtb3VudF9zdHJvb3BzKWAuClRoZSBtYXJrZXRwbGFjZSBjb25zdW1lcyBpdCB0byBkaXN0cmlidXRlIHByb2NlZWRzLgoKYHRvdGFsID0gc2FsZV9wcmljZSAqIHRvdGFsX2JwcyAvIDEwMDAwYDsgZWFjaCBzaGFyZSBpcwpgdG90YWwgKiBzaGFyZV9icHMgLyAxMDAwMGAuIFRoZSBsYXN0IHJlY2lwaWVudCBhYnNvcmJzIHRoZSByb3VuZGluZyBkdXN0CnNvIHRoYXQgdGhlIHN1bSBvZiBhbW91bnRzID09IHRvdGFsLgAAAAAAABBnZXRfcm95YWx0eV9pbmZvAAAAAgAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAAAAAApzYWxlX3ByaWNlAAAAAAALAAAAAQAAA+oAAAPtAAAAAgAAABMAAAAL",
        "AAAAAAAAAAAAAAARc2V0X3Rva2VuX3JveWFsdHkAAAAAAAADAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAAAAAACHJlY2VpdmVyAAAAEwAAAAAAAAAMYmFzaXNfcG9pbnRzAAAABAAAAAA=",
        "AAAAAAAAAYVSZW5vdW5jZXMgb3duZXJzaGlwIG9mIHRoZSBjb250cmFjdC4KClBlcm1hbmVudGx5IHJlbW92ZXMgdGhlIG93bmVyLCBkaXNhYmxpbmcgYWxsIGZ1bmN0aW9ucyBnYXRlZCBieQpgI1tvbmx5X293bmVyXWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCgojIEVycm9ycwoKKiBbYE93bmFibGVFcnJvcjo6VHJhbnNmZXJJblByb2dyZXNzYF0gLSBJZiB0aGVyZSBpcyBhIHBlbmRpbmcgb3duZXJzaGlwCnRyYW5zZmVyLgoqIFtgT3duYWJsZUVycm9yOjpPd25lck5vdFNldGBdIC0gSWYgdGhlIG93bmVyIGlzIG5vdCBzZXQuCgojIE5vdGVzCgoqIEF1dGhvcml6YXRpb24gZm9yIHRoZSBjdXJyZW50IG93bmVyIGlzIHJlcXVpcmVkLgAAAAAAABJyZW5vdW5jZV9vd25lcnNoaXAAAAAAAAAAAAAA",
        "AAAAAAAAA45Jbml0aWF0ZXMgYSAyLXN0ZXAgb3duZXJzaGlwIHRyYW5zZmVyIHRvIGEgbmV3IGFkZHJlc3MuCgpSZXF1aXJlcyBhdXRob3JpemF0aW9uIGZyb20gdGhlIGN1cnJlbnQgb3duZXIuIFRoZSBuZXcgb3duZXIgbXVzdCBsYXRlcgpjYWxsIGBhY2NlcHRfb3duZXJzaGlwKClgIHRvIGNvbXBsZXRlIHRoZSB0cmFuc2Zlci4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgbmV3X293bmVyYCAtIFRoZSBwcm9wb3NlZCBuZXcgb3duZXIuCiogYGxpdmVfdW50aWxfbGVkZ2VyYCAtIExlZGdlciBudW1iZXIgdW50aWwgd2hpY2ggdGhlIG5ldyBvd25lciBjYW4KYWNjZXB0LiBBIHZhbHVlIG9mIGAwYCBjYW5jZWxzIGFueSBwZW5kaW5nIHRyYW5zZmVyLgoKIyBFcnJvcnMKCiogW2BPd25hYmxlRXJyb3I6Ok93bmVyTm90U2V0YF0gLSBJZiB0aGUgb3duZXIgaXMgbm90IHNldC4KKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRyeWluZyB0byBjYW5jZWwgYSB0cmFuc2ZlciB0aGF0IGRvZXNuJ3QgZXhpc3QuCiogW2BjcmF0ZTo6cm9sZV90cmFuc2Zlcjo6Um9sZVRyYW5zZmVyRXJyb3I6OkludmFsaWRMaXZlVW50aWxMZWRnZXJgXSAtCklmIHRoZSBzcGVjaWZpZWQgbGVkZ2VyIGlzIGluIHRoZSBwYXN0LgoqIFtgY3JhdGU6OnJvbGVfdHJhbnNmZXI6OlJvbGVUcmFuc2ZlckVycm9yOjpJbnZhbGlkUGVuZGluZ0FjY291bnRgXSAtCklmIHRoZSBzcGVjaWZpZWQgcGVuZGluZyBhY2NvdW50IGlzIG5vdCB0aGUgc2FtZSBhcyB0aGUgcHJvdmlkZWQgYG5ld2AKYWRkcmVzcy4KCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgb3duZXIgaXMgcmVxdWlyZWQuAAAAAAASdHJhbnNmZXJfb3duZXJzaGlwAAAAAAACAAAAAAAAAAluZXdfb3duZXIAAAAAAAATAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAA",
        "AAAAAAAAANdSZXR1cm5zIHdoZXRoZXIgdGhlIGBvcGVyYXRvcmAgaXMgYWxsb3dlZCB0byBtYW5hZ2UgYWxsIHRoZSBhc3NldHMgb2YKYG93bmVyYC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgb3duZXJgIC0gQWNjb3VudCBvZiB0aGUgdG9rZW4ncyBvd25lci4KKiBgb3BlcmF0b3JgIC0gQWNjb3VudCB0byBiZSBjaGVja2VkLgAAAAATaXNfYXBwcm92ZWRfZm9yX2FsbAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAEAAAAB",
        "AAAAAAAAAAAAAAATc2V0X2RlZmF1bHRfcm95YWx0eQAAAAACAAAAAAAAAAhyZWNlaXZlcgAAABMAAAAAAAAADGJhc2lzX3BvaW50cwAAAAQAAAAA",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYW4gb3duZXJzaGlwIHRyYW5zZmVyIGlzIGluaXRpYXRlZC4AAAAAAAAAAAART3duZXJzaGlwVHJhbnNmZXIAAAAAAAABAAAAEm93bmVyc2hpcF90cmFuc2ZlcgAAAAAAAwAAAAAAAAAJb2xkX293bmVyAAAAAAAAEwAAAAAAAAAAAAAACW5ld19vd25lcgAAAAAAABMAAAAAAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAAAAAAAg==",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gb3duZXJzaGlwIGlzIHJlbm91bmNlZC4AAAAAAAAAAAAST3duZXJzaGlwUmVub3VuY2VkAAAAAAABAAAAE293bmVyc2hpcF9yZW5vdW5jZWQAAAAAAQAAAAAAAAAJb2xkX293bmVyAAAAAAAAEwAAAAAAAAAC",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYW4gb3duZXJzaGlwIHRyYW5zZmVyIGlzIGNvbXBsZXRlZC4AAAAAAAAAAAAaT3duZXJzaGlwVHJhbnNmZXJDb21wbGV0ZWQAAAAAAAEAAAAcb3duZXJzaGlwX3RyYW5zZmVyX2NvbXBsZXRlZAAAAAEAAAAAAAAACW5ld19vd25lcgAAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSB0b2tlbiBpcyBidXJuZWQuAAAAAAAAAAAAAARCdXJuAAAAAQAAAARidXJuAAAAAgAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAAAAAAAg==",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSB0b2tlbiBpcyBtaW50ZWQuAAAAAAAAAAAAAARNaW50AAAAAQAAAARtaW50AAAAAgAAAAAAAAACdG8AAAAAABMAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAAAAAAAg==",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gYW4gYXBwcm92YWwgaXMgZ3JhbnRlZC4AAAAAAAAAAAAHQXBwcm92ZQAAAAABAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAIYXBwcm92ZXIAAAATAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAAAAAAAAIYXBwcm92ZWQAAAATAAAAAAAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAAAAAAI=",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gYSB0b2tlbiBpcyB0cmFuc2ZlcnJlZC4AAAAAAAAAAAAIVHJhbnNmZXIAAAABAAAACHRyYW5zZmVyAAAAAwAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAAC",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYXBwcm92YWwgZm9yIGFsbCB0b2tlbnMgaXMgZ3JhbnRlZC4AAAAAAAAAAAANQXBwcm92ZUZvckFsbAAAAAAAAAEAAAAPYXBwcm92ZV9mb3JfYWxsAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAEAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAAAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAAAAAAC",
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    burn: this.txFromJSON<null>,
    mint: this.txFromJSON<u32>,
    name: this.txFromJSON<string>,
    symbol: this.txFromJSON<string>,
    approve: this.txFromJSON<null>,
    balance: this.txFromJSON<u32>,
    upgrade: this.txFromJSON<null>,
    owner_of: this.txFromJSON<string>,
    registry: this.txFromJSON<string>,
    transfer: this.txFromJSON<null>,
    burn_from: this.txFromJSON<null>,
    get_owner: this.txFromJSON<Option<string>>,
    minter_of: this.txFromJSON<Option<string>>,
    token_uri: this.txFromJSON<string>,
    royalty_bps: this.txFromJSON<u32>,
    get_approved: this.txFromJSON<Option<string>>,
    set_registry: this.txFromJSON<null>,
    transfer_from: this.txFromJSON<null>,
    approve_for_all: this.txFromJSON<null>,
    accept_ownership: this.txFromJSON<null>,
    get_royalty_info: this.txFromJSON<Array<readonly [string, i128]>>,
    set_token_royalty: this.txFromJSON<null>,
    renounce_ownership: this.txFromJSON<null>,
    transfer_ownership: this.txFromJSON<null>,
    is_approved_for_all: this.txFromJSON<boolean>,
    set_default_royalty: this.txFromJSON<null>,
  };
}
