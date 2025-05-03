import { poolPda, pumpPoolAuthorityPda } from '@pump-fun/pump-swap-sdk'
import { WSOLMint } from '@raydium-io/raydium-sdk-v2'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { Connection, PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

const WSOL_MINT_STR = WSOLMint + ''

export const POOLS: {
  [key: string]: {
    id: PublicKey
    baseAta: PublicKey
    quoteAta: PublicKey
    baseMint: PublicKey
    quoteMint: PublicKey
  }
} = {}

export function getPool(intputMint: PublicKey, outputMint: PublicKey) {
  const inputMintStr = intputMint + ''
  const outputMintStr = outputMint + ''

  const baseMint = inputMintStr === WSOL_MINT_STR ? outputMintStr : inputMintStr

  let pool = POOLS[baseMint]

  if (!pool) {
    const mint = new PublicKey(baseMint)
    const poolAuthority = pumpPoolAuthorityPda(mint)
    const id = poolPda(0, poolAuthority[0], mint, WSOLMint)

    const poolBaseAta = getAssociatedTokenAddressSync(mint, id[0], true)
    const poolQuotaAta = getAssociatedTokenAddressSync(WSOLMint, id[0], true)

    pool = {
      id: id[0],
      baseMint: mint,
      quoteMint: WSOLMint,
      baseAta: poolBaseAta,
      quoteAta: poolQuotaAta,
    }

    POOLS[baseMint] = pool
  }

  return pool
}

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

  const baseAmountOut = numerator.div(denominatorEffective)

  // -----------------------------------------------------
  // 5) Calculate maxQuote with slippage
  //    If slippage=1 => factor = (1 + 1/100) = 1.01
  // -----------------------------------------------------
  const precision = new BN(1_000_000_000) // For slippage calculations
  const slippageFactorFloat = (1 + slippage / 100) * 1_000_000_000
  const slippageFactor = new BN(Math.floor(slippageFactorFloat))

  // maxQuote = quote * slippageFactor / 1e9
  const maxQuote = quote.mul(slippageFactor).div(precision)

  return {
    base: baseAmountOut, // Base tokens received after fees
    internalQuoteWithoutFees: effectiveQuote,
    maxQuote, // Maximum quote tokens to pay (with slippage)
  }
}

export async function getBuyAmountOut(
  connection: Connection,
  mint: PublicKey,
  amountIn: bigint,
  slippage: number
) {
  const info = getPool(mint, WSOLMint)

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

// amount

// buy
// buy
// buy
// buy
// sell
// sell

// amount * 1.05
