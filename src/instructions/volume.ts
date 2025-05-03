import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js'

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

import { struct, u64, u8 } from './mashmallow'
import {
  accountMeta,
  jsonInfo2PoolKeys,
  parseBigNumberish,
  SwapFixedInInstructionParamsV4,
} from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'

const PROGRAM_ID = new PublicKey('GxUziWrDrL9RSsbZ4QyhXtqMLefbFwQ8pCsFHzeN6BEZ')

const MODEL_DATA_PUBKEY = new PublicKey(
  'HCYGT9RNcUUV4WpyTW6oYg5XzoT3BrH7gG4mKgPgymW'
)
const FIXED_SWAP_LAYOUT = struct([
  u8('instruction'),
  u64('amountIn'),
  u64('maxReservePossible'),
  u64('minAmountInToSwap'),
])

const VOL_SELL_LAYOUT = struct([
  u8('instruction'),
  u64('amount_to_buyer'),
  u64('need_balance'),
  u8('position'),
  u8('liquidate_seller'),
  u8('liquidate_buyer'),
])

const VOL_BUY_LAYOUT = struct([
  u8('instruction'),
  u64('first_buyers_balance'),
  u8('need_detect'),
])

const LIQUIDATE_LAYOUT = struct([
  u8('instruction'),
  u8('skip_mint'),
  u8('skip_wsol'),
  u8('skip_sol'),
])

export function swapBaseIn(
  {
    poolKeys: propPoolKeys,
    userKeys,
    amountIn,
    minAmountOut,
    minAmountInToSwap,
  }: SwapFixedInInstructionParamsV4 & { minAmountInToSwap: bigint },
  version: number
): TransactionInstruction {
  const poolKeys = jsonInfo2PoolKeys(propPoolKeys)
  const data = Buffer.alloc(FIXED_SWAP_LAYOUT.span)
  FIXED_SWAP_LAYOUT.encode(
    {
      instruction: 0,
      amountIn: parseBigNumberish(amountIn),
      maxReservePossible: parseBigNumberish(minAmountOut),
      minAmountInToSwap: parseBigNumberish(minAmountInToSwap),
    },
    data
  )

  const keys = [
    // amm
    accountMeta({
      pubkey: poolKeys.programId,
      isWritable: false,
      isSigner: false,
    }),
    accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: true }),
    accountMeta({ pubkey: poolKeys.id }), // amm / pool-id
    accountMeta({ pubkey: poolKeys.authority, isWritable: false }), // default
    accountMeta({ pubkey: poolKeys.openOrders }),
  ]

  if (version === 4) keys.push(accountMeta({ pubkey: poolKeys.targetOrders }))
  keys.push(
    accountMeta({ pubkey: poolKeys.vault.A }),
    accountMeta({ pubkey: poolKeys.vault.B })
  )
  if (version === 5) keys.push(accountMeta({ pubkey: MODEL_DATA_PUBKEY }))
  keys.push(
    // serum
    accountMeta({ pubkey: poolKeys.marketProgramId, isWritable: false }),
    accountMeta({ pubkey: poolKeys.marketId }),
    accountMeta({ pubkey: poolKeys.marketBids }),
    accountMeta({ pubkey: poolKeys.marketAsks }),
    accountMeta({ pubkey: poolKeys.marketEventQueue }),
    accountMeta({ pubkey: poolKeys.marketBaseVault }),
    accountMeta({ pubkey: poolKeys.marketQuoteVault }),
    accountMeta({ pubkey: poolKeys.marketAuthority, isWritable: false }),
    // user
    accountMeta({ pubkey: userKeys.tokenAccountIn }),
    accountMeta({ pubkey: userKeys.tokenAccountOut }),
    accountMeta({ pubkey: userKeys.owner, isWritable: false })
  )

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  })
}

export function volSellIx(
  wallet: PublicKey,
  seller: PublicKey,
  buyer: PublicKey,
  mint: PublicKey,
  params: {
    amountToBuyer: bigint
    needBalance: bigint
    position: number
    liquidateSeller: boolean
    liquidateBuyer: boolean
  }
): TransactionInstruction {
  // console.log(params)

  const data = Buffer.alloc(VOL_SELL_LAYOUT.span)
  VOL_SELL_LAYOUT.encode(
    {
      instruction: 1,
      amount_to_buyer: new BN(params.amountToBuyer + ''),
      need_balance: new BN(params.needBalance + ''),
      position: params.position,
      liquidate_seller: params.liquidateSeller ? 1 : 0,
      liquidate_buyer: params.liquidateBuyer ? 1 : 0,
    },
    data
  )

  const sourceAta = getAssociatedTokenAddressSync(mint, seller)
  const destAta = getAssociatedTokenAddressSync(mint, wallet)

  // const [volStateAccount, _] = PublicKey.findProgramAddressSync(
  //   [Buffer.from(VOL_STATE_SEED)],
  //   PROGRAM_ID
  // )

  const keys = [
    { pubkey: wallet, isSigner: true, isWritable: true },
    { pubkey: seller, isSigner: true, isWritable: true },
    { pubkey: buyer, isSigner: false, isWritable: true },
    { pubkey: sourceAta, isSigner: false, isWritable: true },
    { pubkey: destAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  })
}

export function volBuyIx(
  payer: PublicKey,
  seller: PublicKey,
  buyer: PublicKey,
  wallet: PublicKey,
  mint: PublicKey,
  params: {
    buyer: PublicKey | undefined
    balance: bigint
    needDetect: boolean
  }
): TransactionInstruction {
  const data = Buffer.alloc(VOL_BUY_LAYOUT.span)
  VOL_BUY_LAYOUT.encode(
    {
      instruction: 2,
      first_buyers_balance: new BN((params.balance ?? 0) + ''),
      need_detect: params.needDetect ? 1 : 0,
    },
    data
  )

  const buyerAta = getAssociatedTokenAddressSync(mint, buyer)
  const waletAta = getAssociatedTokenAddressSync(mint, wallet)

  // const [volStateAccount, _] = PublicKey.findProgramAddressSync(
  //   [Buffer.from(VOL_STATE_SEED)],
  //   PROGRAM_ID
  // )

  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: buyer, isSigner: true, isWritable: true },
    // { pubkey: seller, isSigner: false, isWritable: false },
  ]

  if (params.buyer) {
    keys.push({ pubkey: params.buyer, isSigner: false, isWritable: false })
  }

  keys.push(
    { pubkey: buyerAta, isSigner: false, isWritable: true },
    { pubkey: waletAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
  )

  // console.log(keys.map((item) => item.pubkey + ''))

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  })
}

export function liquidateAccountIx(
  payer: PublicKey,
  account: PublicKey,
  recipient: PublicKey,
  mint: PublicKey,
  params?: {
    skipMint?: boolean
    skipWsol?: boolean
    skipSol?: boolean
  }
): TransactionInstruction {
  const data = Buffer.alloc(LIQUIDATE_LAYOUT.span)
  LIQUIDATE_LAYOUT.encode(
    {
      instruction: 3,
      skip_mint: params?.skipMint ? 1 : 0,
      skip_wsol: params?.skipSol ? 1 : 0,
      skip_sol: params?.skipSol ? 1 : 0,
    },
    data
  )

  const mintAta = getAssociatedTokenAddressSync(mint, account)
  const recipientAta = getAssociatedTokenAddressSync(mint, recipient)
  const wsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, account)

  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: account, isSigner: true, isWritable: true },
    { pubkey: recipient, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: mintAta, isSigner: false, isWritable: true },
    { pubkey: wsolAta, isSigner: false, isWritable: true },
    { pubkey: recipientAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ]

  // console.log(keys.map((item) => item.pubkey + ''))

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  })
}