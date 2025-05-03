import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js'

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

import {
  lpMintPda,
  poolPda,
  pumpPoolAuthorityPda,
} from '@pump-fun/pump-swap-sdk'

import {
  accountMeta,
  parseBigNumberish,
  WSOLMint,
} from '@raydium-io/raydium-sdk-v2'

import { struct, u64 } from './mashmallow'

export const PROGRAM_ID = new PublicKey(
  'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'
)

export const PUM_FUN_PROGRAM_ID = new PublicKey(
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'
)

const GLOBAL_CONFIG_ACCOUNT = new PublicKey(
  'ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw'
)

const GLOBAL = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf')

const WITHDRAW_AUTORITY = new PublicKey(
  '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg'
)

const PUMP_AMM_EVENT_AUTORITY = new PublicKey(
  'GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR'
)

const EVENT_AUTORITY = new PublicKey(
  'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1'
)

const FEE_RECIPIENT = new PublicKey(
  '7VtfL8fvgNfhz17qKRMjzQEXgbdpnHHHQRh54R9jP2RJ'
)

const FEE_RECIPIENT_ATA = new PublicKey(
  '7GFUN3bWzJMKMRZ34JLsvcqdssDbXnp589SiE33KVwcC'
)

const BUY_LAYOUT = struct([
  // u8('instruction'),
  u64('base_amount_out'),
  u64('max_quote_amount_in'),
])

const SELL_LAYOUT = struct([
  // u8('instruction'),
  u64('base_amount_in'),
  u64('min_quote_amount_out'),
])

export function buyIx({
  poolKeys,
  userKeys,
  maxAmountIn,
  amountOut,
}: {
  poolKeys: {
    poolId: PublicKey
    baseMint: PublicKey
    qouteMint: PublicKey
    poolBaseAta: PublicKey
    poolQouteAta: PublicKey
  }
  userKeys: { payer: Keypair }
  maxAmountIn: any
  amountOut: any
}): TransactionInstruction {
  // const poolKeys = jsonInfo2PoolKeys(propPoolKeys)
  const data = Buffer.alloc(BUY_LAYOUT.span)
  BUY_LAYOUT.encode(
    {
      base_amount_out: parseBigNumberish(amountOut),
      max_quote_amount_in: parseBigNumberish(maxAmountIn),
    },
    data
  )

  const discriminator = Buffer.from('66063d1201daebea', 'hex')

  // Final instruction data
  const finalInstructionData = Buffer.concat([discriminator, data])

  const baseAta = getAssociatedTokenAddressSync(
    poolKeys.baseMint,
    userKeys.payer.publicKey
  )

  const quoteAta = getAssociatedTokenAddressSync(
    poolKeys.qouteMint,
    userKeys.payer.publicKey
  )

  const keys = []

  keys.push(
    accountMeta({
      pubkey: poolKeys.poolId,
      isWritable: false,
      isSigner: false,
    }),
    accountMeta({
      pubkey: userKeys.payer.publicKey,
      isSigner: true,
      isWritable: true,
    }),
    accountMeta({ pubkey: GLOBAL_CONFIG_ACCOUNT, isWritable: false }), // amm / pool-id

    accountMeta({ pubkey: poolKeys.baseMint, isWritable: false }),
    accountMeta({ pubkey: poolKeys.qouteMint, isWritable: false }),

    accountMeta({ pubkey: baseAta, isWritable: true }),
    accountMeta({ pubkey: quoteAta, isWritable: true }),

    accountMeta({ pubkey: poolKeys.poolBaseAta, isWritable: true }),
    accountMeta({ pubkey: poolKeys.poolQouteAta, isWritable: true }),
    accountMeta({ pubkey: FEE_RECIPIENT, isWritable: false }),
    accountMeta({ pubkey: FEE_RECIPIENT_ATA, isWritable: true }),
    accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
    accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
    accountMeta({ pubkey: SystemProgram.programId, isWritable: false }),
    accountMeta({ pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isWritable: false }),
    accountMeta({ pubkey: PUMP_AMM_EVENT_AUTORITY, isWritable: false }),
    accountMeta({ pubkey: PROGRAM_ID, isWritable: false })
  )

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: finalInstructionData,
  })
}

export function sellIx({
  poolKeys,
  userKeys,
  amountIn,
  minAmountOut,
}: {
  poolKeys: {
    poolId: PublicKey
    baseMint: PublicKey
    qouteMint: PublicKey
    poolBaseAta: PublicKey
    poolQouteAta: PublicKey
    // feeRecipient: PublicKey
    // feeRecipientAta: PublicKey
  }
  userKeys: { payer: Keypair }
  amountIn: any
  minAmountOut: any
}): TransactionInstruction {
  // const poolKeys = jsonInfo2PoolKeys(propPoolKeys)
  const data = Buffer.alloc(SELL_LAYOUT.span)
  SELL_LAYOUT.encode(
    {
      base_amount_in: parseBigNumberish(amountIn),
      min_quote_amount_out: parseBigNumberish(minAmountOut),
    },
    data
  )

  const discriminator = Buffer.from('33e685a4017f83ad', 'hex')

  // Final instruction data
  const finalInstructionData = Buffer.concat([discriminator, data])

  const baseAta = getAssociatedTokenAddressSync(
    poolKeys.baseMint,
    userKeys.payer.publicKey
  )
  const quoteAta = getAssociatedTokenAddressSync(
    poolKeys.qouteMint,
    userKeys.payer.publicKey
  )

  const keys = []

  keys.push(
    accountMeta({
      pubkey: poolKeys.poolId,
      isWritable: false,
    }),
    accountMeta({
      pubkey: userKeys.payer.publicKey,
      isSigner: true,
      isWritable: true,
    }),
    accountMeta({ pubkey: GLOBAL_CONFIG_ACCOUNT, isWritable: false }), // amm / pool-id

    accountMeta({ pubkey: poolKeys.baseMint, isWritable: false }),
    accountMeta({ pubkey: poolKeys.qouteMint, isWritable: false }),

    accountMeta({ pubkey: baseAta, isWritable: true }),
    accountMeta({ pubkey: quoteAta, isWritable: true }),

    accountMeta({ pubkey: poolKeys.poolBaseAta, isWritable: true }),
    accountMeta({ pubkey: poolKeys.poolQouteAta, isWritable: true }),
    accountMeta({ pubkey: FEE_RECIPIENT, isWritable: false }),
    accountMeta({ pubkey: FEE_RECIPIENT_ATA, isWritable: true }),
    accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
    accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
    accountMeta({ pubkey: SystemProgram.programId, isWritable: false }),
    accountMeta({ pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isWritable: false }),
    accountMeta({ pubkey: PUMP_AMM_EVENT_AUTORITY, isWritable: false }),
    accountMeta({ pubkey: PROGRAM_ID, isWritable: false })
  )

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: finalInstructionData,
  })
}

export function migrateIx(
  payer: PublicKey,
  mint: PublicKey,
  bondingCurve: PublicKey
): TransactionInstruction {
  const data = Buffer.from('9beae792ec9ea21e', 'hex')

  const bondingCurveAta = getAssociatedTokenAddressSync(
    mint,
    bondingCurve,
    true
  )
  const poolAuthority = pumpPoolAuthorityPda(mint)
  const pool = poolPda(0, poolAuthority[0], mint, WSOLMint)
  const lp = lpMintPda(pool[0])
  const poolAuthMint = getAssociatedTokenAddressSync(
    mint,
    poolAuthority[0],
    true
  )
  const poolAuthWSOL = getAssociatedTokenAddressSync(
    WSOLMint,
    poolAuthority[0],
    true
  )
  const userPoolAta = getAssociatedTokenAddressSync(
    lp[0],
    poolAuthority[0],
    true,
    TOKEN_2022_PROGRAM_ID
  )
  const poolBaseAta = getAssociatedTokenAddressSync(mint, pool[0], true)
  const poolQuotaAta = getAssociatedTokenAddressSync(WSOLMint, pool[0], true)

  const keys = [
    { pubkey: GLOBAL, isSigner: false, isWritable: false },
    { pubkey: WITHDRAW_AUTORITY, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: bondingCurve, isSigner: false, isWritable: true },
    { pubkey: bondingCurveAta, isSigner: false, isWritable: true },
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },

    { pubkey: pool[0], isSigner: false, isWritable: true },
    { pubkey: poolAuthority[0], isSigner: false, isWritable: true },
    { pubkey: poolAuthMint, isSigner: false, isWritable: true },
    { pubkey: poolAuthWSOL, isSigner: false, isWritable: true },
    { pubkey: GLOBAL_CONFIG_ACCOUNT, isSigner: false, isWritable: false },
    { pubkey: WSOLMint, isSigner: false, isWritable: false },

    { pubkey: lp[0], isSigner: false, isWritable: true },
    { pubkey: userPoolAta, isSigner: false, isWritable: true },
    { pubkey: poolBaseAta, isSigner: false, isWritable: true },
    { pubkey: poolQuotaAta, isSigner: false, isWritable: true },

    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: PUMP_AMM_EVENT_AUTORITY, isSigner: false, isWritable: false },
    { pubkey: EVENT_AUTORITY, isSigner: false, isWritable: false },
    { pubkey: PUM_FUN_PROGRAM_ID, isSigner: false, isWritable: false },
  ]

  return new TransactionInstruction({
    programId: PUM_FUN_PROGRAM_ID,
    keys,
    data,
  })
}

export function getKeys(
  payer: PublicKey,
  poolKeys: {
    id: PublicKey
    baseMint: PublicKey
    quoteMint: PublicKey
    baseAta: PublicKey
    quoteAta: PublicKey
  }
) {
  const baseAta = getAssociatedTokenAddressSync(poolKeys.baseMint, payer)
  const quoteAta = getAssociatedTokenAddressSync(poolKeys.quoteMint, payer)

  return [
    accountMeta({
      pubkey: poolKeys.id,
      isWritable: false,
    }),
    accountMeta({ pubkey: payer, isSigner: true, isWritable: true }),
    accountMeta({ pubkey: GLOBAL_CONFIG_ACCOUNT, isWritable: false }), // amm / pool-id

    accountMeta({ pubkey: poolKeys.baseMint, isWritable: false }),
    accountMeta({ pubkey: poolKeys.quoteMint, isWritable: false }),

    accountMeta({ pubkey: baseAta, isWritable: true }),
    accountMeta({ pubkey: quoteAta, isWritable: true }),

    accountMeta({ pubkey: poolKeys.baseAta, isWritable: true }),
    accountMeta({ pubkey: poolKeys.quoteAta, isWritable: true }),
    accountMeta({ pubkey: FEE_RECIPIENT, isWritable: false }),
    accountMeta({ pubkey: FEE_RECIPIENT_ATA, isWritable: true }),
    accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
    accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
    accountMeta({ pubkey: SystemProgram.programId, isWritable: false }),
    accountMeta({ pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isWritable: false }),
    accountMeta({ pubkey: PUMP_AMM_EVENT_AUTORITY, isWritable: false }),
    accountMeta({ pubkey: PROGRAM_ID, isWritable: false }),
  ]
}
