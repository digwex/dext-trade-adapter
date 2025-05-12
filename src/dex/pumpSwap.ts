import {
  getPumpAmmProgram,
  Pool,
  poolPda,
  PumpAmm,
  pumpPoolAuthorityPda,
  SellBaseInputResult,
} from '@pump-fun/pump-swap-sdk'

import { WSOLMint } from '@raydium-io/raydium-sdk-v2'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { getSolanaConnection } from '..'
import {
  coinCreatorVaultAuthorityPda,
  PROGRAM_ID,
} from '../instructions/pumpSwap'
import { Program } from '@coral-xyz/anchor'

const PECISSIONS = new BN(1_000_000_000)

const WSOL_MINT_STR = WSOLMint + ''

let PUMP_AMM_PROGRMAM_ANCHOR: Program<PumpAmm>

export const POOLS: {
  [key: string]: {
    id: PublicKey
    baseAta: PublicKey
    quoteAta: PublicKey
    baseMint: PublicKey
    quoteMint: PublicKey
    coinCreatorVaultAuthority: PublicKey
  }
} = {}

export function buyQuoteInputInternal(
  quote: BN,
  slippage: number, // 1 => 1%
  baseReserve: BN,
  quoteReserve: BN,
  lpFeeBps: BN, // LP fee in basis points (BN)
  protocolFeeBps: BN // Protocol fee in basis points (BN)
) {
  // -----------------------------------------------------
  // 1) Basic validations
  // -----------------------------------------------------
  if (quote.isZero()) {
    throw new Error("Invalid input: 'quote' cannot be zero.")
  }
  if (baseReserve.isZero() || quoteReserve.isZero()) {
    throw new Error(
      "Invalid input: 'baseReserve' or 'quoteReserve' cannot be zero."
    )
  }
  if (lpFeeBps.isNeg() || protocolFeeBps.isNeg()) {
    throw new Error('Fee basis points cannot be negative.')
  }

  // -----------------------------------------------------
  // 2) Calculate total fee basis points and denominator
  // -----------------------------------------------------
  const totalFeeBps = lpFeeBps.add(protocolFeeBps)
  const denominator = new BN(10_000).add(totalFeeBps)

  // -----------------------------------------------------
  // 3) Calculate effective quote amount
  // -----------------------------------------------------
  const effectiveQuote = quote.mul(new BN(10_000)).div(denominator)

  // -----------------------------------------------------
  // 4) Calculate the base tokens received using effectiveQuote
  //    base_amount_out = floor(base_reserve * effectiveQuote / (quote_reserve + effectiveQuote))
  // -----------------------------------------------------
  const numerator = baseReserve.mul(effectiveQuote)
  const denominatorEffective = quoteReserve.add(effectiveQuote)

  if (denominatorEffective.isZero()) {
    throw new Error('Pool would be depleted; denominator is zero.')
  }

  // -----------------------------------------------------
  // 5) Calculate maxQuote with slippage
  //    If slippage = 1 => factor = (1 - 1/100) = 0.99
  // -----------------------------------------------------

  const slippageFactorFloat = (1 - slippage / 100) * 1_000_000_000
  const slippageFactor = new BN(Math.floor(slippageFactorFloat))

  // maxQuote = quote * slippageFactor / 1e9
  // const maxQuote = quote.mul(slippageFactor).div(PECISSIONS)

  const baseAmountOut = numerator
    .div(denominatorEffective)
    .mul(slippageFactor)
    .div(PECISSIONS)

  return {
    base: baseAmountOut, // Base tokens received after fees
    internalQuoteWithoutFees: effectiveQuote,
    maxQuote: quote, // Maximum quote tokens to pay (with slippage)
  }
}

export function ceilDiv(a: BN, b: BN): BN {
  if (b.isZero()) {
    throw new Error('Cannot divide by zero.')
  }
  return a.add(b.subn(1)).div(b)
}

export function fee(amount: BN, basisPoints: BN): BN {
  return ceilDiv(amount.mul(basisPoints), new BN(10_000))
}

export function sellBaseInputInternal(
  base: BN, // The amount of base tokens the user wants to sell
  slippage: number, // e.g. 1 => 1% slippage tolerance
  baseReserve: BN, // Current reserve of base tokens in the pool
  quoteReserve: BN, // Current reserve of quote tokens in the pool
  lpFeeBps: BN, // LP fee in basis points (e.g., 30 => 0.30%)
  protocolFeeBps: BN // Protocol fee in basis points (e.g., 20 => 0.20%)
): SellBaseInputResult {
  // -----------------------------------------
  // 1) Basic validations
  // -----------------------------------------
  if (base.isZero()) {
    throw new Error("Invalid input: 'base' (base_amount_in) cannot be zero.")
  }
  if (baseReserve.isZero() || quoteReserve.isZero()) {
    throw new Error(
      "Invalid input: 'baseReserve' or 'quoteReserve' cannot be zero."
    )
  }
  if (lpFeeBps.isNeg() || protocolFeeBps.isNeg()) {
    throw new Error('Fee basis points cannot be negative.')
  }

  // -----------------------------------------
  // 2) Calculate the raw quote output (no fees)
  //    This matches a typical constant-product formula for selling base to get quote:
  //      quote_amount_out = floor( (quoteReserve * base) / (baseReserve + base) )
  // -----------------------------------------
  const quoteAmountOut = quoteReserve.mul(base).div(baseReserve.add(base)) // floor by BN.div

  // -----------------------------------------
  // 3) Calculate fees
  //    LP fee and protocol fee are both taken from 'quoteAmountOut'
  // -----------------------------------------
  const lpFee = fee(quoteAmountOut, lpFeeBps)
  const protocolFee = fee(quoteAmountOut, protocolFeeBps)

  // Subtract fees to get the actual user receive
  const finalQuote = quoteAmountOut.sub(lpFee).sub(protocolFee)
  if (finalQuote.isNeg()) {
    // Theoretically shouldn't happen unless fees exceed quoteAmountOut
    throw new Error('Fees exceed total output; final quote is negative.')
  }

  // -----------------------------------------
  // 4) Calculate minQuote with slippage
  //    - If slippage=1 => 1%, we allow receiving as low as 99% of finalQuote
  // -----------------------------------------
  // (1 - slippage/100) => e.g. slippage=1 => factor= 0.99
  const slippageFactorFloat = (1 - slippage / 100) * 1_000_000_000
  const slippageFactor = new BN(Math.floor(slippageFactorFloat))

  // minQuote = finalQuote * (1 - slippage/100)
  const minQuote = finalQuote.mul(slippageFactor).div(PECISSIONS)

  return {
    uiQuote: finalQuote, // actual tokens user receives after fees
    minQuote, // minimum acceptable tokens after applying slippage
    internalQuoteAmountOut: quoteAmountOut,
  }
}

export async function getPool(intputMint: PublicKey, outputMint: PublicKey) {
  const inputMintStr = intputMint + ''
  const outputMintStr = outputMint + ''

  const baseMint = inputMintStr === WSOL_MINT_STR ? outputMintStr : inputMintStr

  let pool = POOLS[baseMint]

  if (!pool) {
    const mint = new PublicKey(baseMint)
    const poolAuthority = pumpPoolAuthorityPda(mint)
    const id = poolPda(0, poolAuthority[0], mint, WSOLMint)

    const connection = getSolanaConnection()

    if (!PUMP_AMM_PROGRMAM_ANCHOR) {
      PUMP_AMM_PROGRMAM_ANCHOR = getPumpAmmProgram(connection, PROGRAM_ID + '')
    }

    const poolAccountInfo = await connection.getAccountInfo(id[0])

    const poolData = PUMP_AMM_PROGRMAM_ANCHOR.coder.accounts.decode<Pool>(
      'pool',
      poolAccountInfo!!.data
    )

    const coinCreatorVaultAuthority = coinCreatorVaultAuthorityPda(
      poolData.coinCreator
    )

    const poolBaseAta = getAssociatedTokenAddressSync(mint, id[0], true)
    const poolQuotaAta = getAssociatedTokenAddressSync(WSOLMint, id[0], true)

    pool = {
      id: id[0],
      baseMint: mint,
      quoteMint: WSOLMint,
      baseAta: poolBaseAta,
      quoteAta: poolQuotaAta,
      coinCreatorVaultAuthority,
    }

    POOLS[baseMint] = pool
  }

  return pool
}

// export function buyQuoteInputInternal(
//   quote: BN,
//   slippage: number, // 1 => 1%
//   baseReserve: BN,
//   quoteReserve: BN,
//   lpFeeBps: BN, // LP fee in basis points (BN)
//   protocolFeeBps: BN // Protocol fee in basis points (BN)
// ) {
//   // -----------------------------------------------------
//   // 1) Basic validations
//   // -----------------------------------------------------
//   if (quote.isZero()) {
//     throw new Error("Invalid input: 'quote' cannot be zero.")
//   }
//   if (baseReserve.isZero() || quoteReserve.isZero()) {
//     throw new Error(
//       "Invalid input: 'baseReserve' or 'quoteReserve' cannot be zero."
//     )
//   }
//   if (lpFeeBps.isNeg() || protocolFeeBps.isNeg()) {
//     throw new Error('Fee basis points cannot be negative.')
//   }

//   // -----------------------------------------------------
//   // 2) Calculate total fee basis points and denominator
//   // -----------------------------------------------------
//   const totalFeeBps = lpFeeBps.add(protocolFeeBps)
//   const denominator = new BN(10_000).add(totalFeeBps)

//   // -----------------------------------------------------
//   // 3) Calculate effective quote amount
//   // -----------------------------------------------------
//   const effectiveQuote = quote.mul(new BN(10_000)).div(denominator)

//   // -----------------------------------------------------
//   // 4) Calculate the base tokens received using effectiveQuote
//   //    base_amount_out = floor(base_reserve * effectiveQuote / (quote_reserve + effectiveQuote))
//   // -----------------------------------------------------
//   const numerator = baseReserve.mul(effectiveQuote)
//   const denominatorEffective = quoteReserve.add(effectiveQuote)

//   if (denominatorEffective.isZero()) {
//     throw new Error('Pool would be depleted; denominator is zero.')
//   }

//   const baseAmountOut = numerator.div(denominatorEffective)

//   // -----------------------------------------------------
//   // 5) Calculate maxQuote with slippage
//   //    If slippage=1 => factor = (1 + 1/100) = 1.01
//   // -----------------------------------------------------
//   const precision = new BN(1_000_000_000) // For slippage calculations
//   const slippageFactorFloat = (1 + slippage / 100) * 1_000_000_000
//   const slippageFactor = new BN(Math.floor(slippageFactorFloat))

//   // maxQuote = quote * slippageFactor / 1e9
//   const maxQuote = quote.mul(slippageFactor).div(precision)

//   return {
//     base: baseAmountOut, // Base tokens received after fees
//     internalQuoteWithoutFees: effectiveQuote,
//     maxQuote, // Maximum quote tokens to pay (with slippage)
//   }
// }

export async function getBuyAmountOut(
  mint: PublicKey,
  amountIn: bigint,
  slippage: number
) {
  const connection = getSolanaConnection()
  const info = await getPool(mint, WSOLMint)

  const [baseBalance, quoteBalance] = await Promise.all([
    connection.getTokenAccountBalance(info.baseAta),
    connection.getTokenAccountBalance(info.quoteAta),
  ])

  // console.log('Base reserve:', baseBalance.value.uiAmountString)
  // console.log('Quote reserve:', quoteBalance.value.uiAmountString)

  // return [baseBalance, quoteBalance]

  const amountInfo = buyQuoteInputInternal(
    new BN(amountIn + ''),
    slippage,
    new BN(baseBalance.value.amount),
    new BN(quoteBalance.value.amount),
    new BN(20),
    new BN(5)
  )

  return BigInt(amountInfo.base + '')
}

export async function getSellAmountOut(
  mint: PublicKey,
  amountIn: bigint,
  slippage: number
) {
  const connection = getSolanaConnection()
  const info = await getPool(mint, WSOLMint)

  const [baseBalance, quoteBalance] = await Promise.all([
    connection.getTokenAccountBalance(info.baseAta),
    connection.getTokenAccountBalance(info.quoteAta),
  ])

  // console.log('Base reserve:', baseBalance.value.uiAmountString)
  // console.log('Quote reserve:', quoteBalance.value.uiAmountString)

  // return [baseBalance, quoteBalance]

  const amountInfo = sellBaseInputInternal(
    new BN(amountIn + ''),
    slippage,
    new BN(baseBalance.value.amount),
    new BN(quoteBalance.value.amount),
    new BN(20),
    new BN(5)
  )

  return BigInt(amountInfo.minQuote + '')
}

// amount

// buy
// buy
// buy
// buy
// sell
// sell

// amount * 1.05
