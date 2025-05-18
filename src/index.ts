import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import * as pumpSwap from './instructions/pumpSwap'
import { getBuyAmountOut, getPool, getSellAmountOut } from './dex/pumpSwap'

import { sendVtx } from './services/trade.service'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { prepareWsolSwapInstructions } from './helpers/solana.helpers'
import { IPoolCache, RaydiumPool, RaydiumPoolType } from './dex/pool-cache'
import { RaydiumAmm } from './dex/raydium/amm/raydium-amm'
import { RaydiumCpmm } from './dex/raydium/cpmm/raydium-cpmm'
import { Raydium } from '@raydium-io/raydium-sdk-v2'

const PERCENT_BPS = 10_000n

export interface IDEXAdapter {
  // send tx and return signature

  buy(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }>

  buyWithFees(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number,
    serviceFee: {
      wallet: PublicKey
      percent: number
    },
    referralsFee: {
      wallet: PublicKey
      percent: number
    }[]
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }>

  // send tx and return signature
  sell(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }>

  sellWithFees(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number,
    serviceFee: {
      wallet: PublicKey
      percent: number
    },
    referralsFee: {
      wallet: PublicKey
      percent: number
    }[]
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }>

  // send tx and return signature
  swap(
    fromToken: string,
    toToken: string,
    amount: number,
    slippage: number,
    by: 'sell' | 'buy'
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }>

  // only instruction for sell without create ATA if posible for specific platfor pumpSwap, raydium, orca and other
  sellIx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction

  // only instruction for buy without create ATA if posible for specific platfor pumpSwap, raydium, orca and other
  buyIx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction

  // need for calc amount
  getQuote(
    fromToken: string,
    toToken: string,
    amount: number,
    by: 'sell' | 'buy'
  ): Promise<bigint>
}

export class RaydiumAdapter implements IDEXAdapter {
  private readonly handlers: Record<
    RaydiumPoolType,
    RaydiumAmm | RaydiumCpmm | undefined
  >
  constructor(
    private readonly cache: IPoolCache<RaydiumPool>,
    private readonly raydium: Raydium,
    private readonly getConnection: () => Connection
  ) {
    this.handlers = {
      [RaydiumPoolType.AMM]: new RaydiumAmm(cache, raydium, getConnection),
      [RaydiumPoolType.CPMM]: new RaydiumCpmm(cache, getConnection),
      [RaydiumPoolType.AMM_STABLE]: undefined,
      [RaydiumPoolType.CLMM]: undefined,
    }
  }
  buy(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }> {
    throw new Error('Method not implemented.')
  }
  buyWithFees(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number,
    serviceFee: {
      wallet: PublicKey
      percent: number
    },
    referralsFee: {
      wallet: PublicKey
      percent: number
    }[]
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }> {
    throw new Error('Method not implemented.')
  }
  sell(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }> {
    throw new Error('Method not implemented.')
  }
  sellWithFees(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number,
    serviceFee: {
      wallet: PublicKey
      percent: number
    },
    referralsFee: {
      wallet: PublicKey
      percent: number
    }[]
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }> {
    throw new Error('Method not implemented.')
  }
  swap(
    fromToken: string,
    toToken: string,
    amount: number,
    slippage: number,
    by: 'sell' | 'buy'
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }> {
    throw new Error('Method not implemented.')
  }
  getQuote(
    fromToken: string,
    toToken: string,
    amount: number,
    by: 'sell' | 'buy'
  ): Promise<bigint> {
    throw new Error('Method not implemented.')
  }

  getQuote_(
    fromToken: PublicKey,
    toToken: PublicKey,
    amount: bigint,
    slippage: number
  ): Promise<bigint> {
    // get pool type
    // const baseIn = inputMint === poolInfo.mintA.address
    // get pool from ccache
    // get reserves
    // const swapResult = CurveCalculator.swap(
    //   inputAmount,
    //   baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
    //   baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
    //   rpcData.configInfo!.tradeFeeRate
    // )
    throw new Error('Method not implemented.')
  }
  jupTx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): Promise<Transaction> {
    throw new Error('Method not implemented.')
  }

  async swapByPool(
    poolId: PublicKey,
    wallet: PublicKey,
    intputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<TransactionInstruction> {
    // const cache = await this.cache.read(poolId)
    // if (!cache) throw new Error(`Pool ${poolId.toBase58()} not found`)

    // const handler = this.handlers[cache.type]

    // if (!handler) throw new Error(`Unsupported pool type: ${cache.type}`)

    // const pool = await getRaydiumPool(poolId, intputMint, outputMint, amountIn)

    // const srcAta = getAssociatedTokenAddressSync(intputMint, wallet)
    // const destAta = getAssociatedTokenAddressSync(intputMint, wallet)

    // const swapIxs = await generateSwapInstruction(
    //   intputMint,
    //   outputMint,
    //   {
    //     wallet,
    //     srcAta,
    //     destAta,
    //   },
    //   pool.computeLayout,
    //   pool.poolKeys
    // )

    // // get pool keys
    // // prepate ata | prepare IX ??
    // // get Ix

    // return swapIxs[0]

    throw new Error('Method not implemented.')
  }

  buyIx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction {
    throw new Error('Method not implemented.')
  }
  rugIx(wallet: PublicKey, mint: PublicKey): TransactionInstruction {
    throw new Error('Method not implemented.')
  }
  sellIx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction {
    throw new Error('Method not implemented.')
  }
  retailBuyIx(
    buyer: PublicKey,
    collect: PublicKey,
    mint: PublicKey,
    fees: bigint,
    wex?: {
      lamports: bigint
      index: number
      owner: PublicKey
    }
  ): TransactionInstruction {
    throw new Error('Method not implemented.')
  }
  retailSellIx(
    seller: PublicKey,
    mint: PublicKey,
    amount: bigint,
    wex?: {
      lamports: bigint
      index: number
      owner: PublicKey
    }
  ): TransactionInstruction {
    throw new Error('Method not implemented.')
  }
  buy_(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): string {
    return ''
  }
  sell_(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): string {
    return ''
  }

  async swap_(
    fromToken: string,
    toToken: string,
    amount: number,
    slippage: number
  ): Promise<string> {
    // Генерация и отправка транзакции на Raydium
    return '0x123txhash'
  }

  async getPoolInfo(): Promise<any> {
    // Возврат информации о пулах
    return { pool: 'RAY-USDC' }
  }
}

export class PumpSwapAdapter implements IDEXAdapter {
  constructor(private readonly getConnection: () => Connection) {}

  async sellWithFees(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number,
    serviceFee: {
      wallet: PublicKey
      percent: number
    },
    referralsFee: {
      wallet: PublicKey
      percent: number
    }[]
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }> {
    const connection = this.getConnection()

    const pool = await getPool(connection, inputMint, outputMint)

    const prepareWsol = await prepareWsolSwapInstructions(
      connection,
      wallet.publicKey,
      0n
    )

    if (amountOut === 0n) {
      amountOut = await getSellAmountOut(
        connection,
        inputMint,
        amountIn,
        slippage
      )
    }

    const feeAmount =
      (amountOut * BigInt(Math.floor(serviceFee.percent * 100))) / PERCENT_BPS +
      890880n * BigInt(referralsFee.length) // 1e6 * 1.5 * 100 / 10000

    let minAmountOut = amountOut - feeAmount

    console.log('sell', {
      input: amountIn,
      minAmountOut,
      mint: inputMint,
      slippage,
    })

    const swapIx = pumpSwap.sellIx({
      poolKeys: {
        poolId: pool.id,
        baseMint: inputMint,
        qouteMint: outputMint,
        poolBaseAta: pool.baseAta,
        poolQouteAta: pool.quoteAta,
        coinCreatorVaultAuthority: pool.coinCreatorVaultAuthority,
      },
      userKeys: {
        payer: wallet,
      },
      amountIn: amountIn,
      minAmountOut: minAmountOut,
    })

    const tx = new Transaction()
      .add(...prepareWsol.instructionParams.instructions)
      .add(swapIx)

    if (prepareWsol.instructionParams.endInstructions.length > 0) {
      tx.add(...prepareWsol.instructionParams.endInstructions)
    }

    addFeeToTx(tx, wallet.publicKey, feeAmount, serviceFee, referralsFee)

    const result = await sendVtx(connection, wallet, tx, [wallet], true)

    return result
  }
  async buyWithFees(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number,
    serviceFee: {
      wallet: PublicKey
      percent: number
    },
    referralsFee: {
      wallet: PublicKey
      percent: number
    }[]
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }> {
    const connection = this.getConnection()

    const pool = await getPool(connection, inputMint, outputMint)

    const feeAmount =
      (amountIn * BigInt(Math.floor(serviceFee.percent * 100))) / PERCENT_BPS +
      890880n * BigInt(referralsFee.length) // 1e6 * 1.5 * 100 / 10000

    amountIn -= feeAmount

    const prepareWsol = await prepareWsolSwapInstructions(
      connection,
      wallet.publicKey,
      amountIn
    )

    if (amountOut == 0n) {
      amountOut = await getBuyAmountOut(
        connection,
        outputMint,
        amountIn,
        slippage
      )
    }

    console.log('buy', {
      input: amountIn,
      amountOut,
      mint: outputMint,
      slippage,
    })

    const swapIx = pumpSwap.buyIx({
      poolKeys: {
        poolId: pool.id,
        baseMint: outputMint,
        qouteMint: inputMint,
        poolBaseAta: pool.baseAta,
        poolQouteAta: pool.quoteAta,
        coinCreatorVaultAuthority: pool.coinCreatorVaultAuthority,
      },
      userKeys: {
        payer: wallet,
      },
      maxAmountIn: amountIn,
      amountOut,
    })

    const tx = new Transaction().add(
      ...prepareWsol.instructionParams.instructions
    )

    const ata = getAssociatedTokenAddressSync(outputMint, wallet.publicKey)

    try {
      await getAccount(connection, ata)
    } catch (e) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          ata,
          wallet.publicKey,
          outputMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    }

    tx.add(swapIx)

    if (prepareWsol.instructionParams.endInstructions.length > 0) {
      tx.add(...prepareWsol.instructionParams.endInstructions)
    }

    addFeeToTx(tx, wallet.publicKey, feeAmount, serviceFee, referralsFee)

    const result = await sendVtx(connection, wallet, tx, [wallet], true)

    return result
  }
  buyIx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction {
    throw new Error('Method not implemented.')
  }
  sellIx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction {
    throw new Error('Method not implemented.')

    // const tx = ammSell(wallet, inputMint, outputMint, amountIn, amountOut)

    // return tx.instructions[0]
  }
  async sell(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }> {
    const connection = this.getConnection()

    const pool = await getPool(connection, inputMint, outputMint)

    const prepareWsol = await prepareWsolSwapInstructions(
      connection,
      wallet.publicKey,
      0n
    )

    const swapIx = pumpSwap.sellIx({
      poolKeys: {
        poolId: pool.id,
        baseMint: inputMint,
        qouteMint: outputMint,
        poolBaseAta: pool.baseAta,
        poolQouteAta: pool.quoteAta,
        coinCreatorVaultAuthority: (await pool).coinCreatorVaultAuthority,
      },
      userKeys: {
        payer: wallet,
      },
      amountIn: amountIn,
      minAmountOut: amountOut,
    })

    const tx = new Transaction()
      .add(...prepareWsol.instructionParams.instructions)
      .add(swapIx)

    if (prepareWsol.instructionParams.endInstructions.length > 0) {
      tx.add(...prepareWsol.instructionParams.endInstructions)
    }

    const result = await sendVtx(connection, wallet, tx, [wallet], true)

    return result

    // throw new Error('Method not implemented.')
  }

  async buy(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }> {
    const connection = this.getConnection()

    const pool = await getPool(connection, inputMint, outputMint)

    const prepareWsol = await prepareWsolSwapInstructions(
      connection,
      wallet.publicKey,
      amountIn
    )

    if (amountOut == 0n) {
      amountOut = await getBuyAmountOut(
        connection,
        outputMint,
        amountIn,
        slippage
      )
    }

    const swapIx = pumpSwap.buyIx({
      poolKeys: {
        poolId: pool.id,
        baseMint: outputMint,
        qouteMint: inputMint,
        poolBaseAta: pool.baseAta,
        poolQouteAta: pool.quoteAta,
        coinCreatorVaultAuthority: pool.coinCreatorVaultAuthority,
      },
      userKeys: {
        payer: wallet,
      },
      maxAmountIn: amountIn,
      amountOut,
    })

    const tx = new Transaction().add(
      ...prepareWsol.instructionParams.instructions
    )

    const ata = getAssociatedTokenAddressSync(outputMint, wallet.publicKey)

    try {
      await getAccount(connection, ata)
    } catch (e) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          ata,
          wallet.publicKey,
          outputMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    }

    tx.add(swapIx)

    if (prepareWsol.instructionParams.endInstructions.length > 0) {
      tx.add(...prepareWsol.instructionParams.endInstructions)
    }

    const result = await sendVtx(connection, wallet, tx, [wallet], true)

    return result
  }

  async swap(
    fromToken: string,
    toToken: string,
    amount: number,
    slippage: number
  ): Promise<{
    signature?: string
    error?: {
      type: number
      msg: string
    }
  }> {
    throw new Error('Method not implemented.')
  }

  async getQuote(
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<bigint> {
    // Подключение к Raydium API или on-chain quote
    throw new Error('Method not implemented.')
  }
}

export class DEXFactory {
  static create<T>(
    dex: 'raydium' | 'orca' | 'pumpswap',
    cache: IPoolCache<T>,
    getConnection: () => Connection,
    raydium: Raydium
  ): IDEXAdapter {
    switch (dex) {
      case 'pumpswap':
        return new PumpSwapAdapter(getConnection)
      case 'raydium': {
        return new RaydiumAdapter(
          cache as IPoolCache<RaydiumPool>,
          raydium,
          getConnection
        )
      }
      // case 'orca':
      //   return new OrcaAdapter()
      default:
        throw new Error(`Unsupported DEX: ${dex}`)
    }
  }

  // static
}

export interface ISwapStrategy {
  executeSwap(
    adapter: IDEXAdapter,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<string> // returns txHash
}

export class MarketSwapStrategy implements ISwapStrategy {
  constructor(private slippage: number = 0.5) {}

  async executeSwap(
    adapter: IDEXAdapter,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<string> {
    return '' // adapter.swap(fromToken, toToken, amount, this.slippage)
  }
}

export class LimitSwapStrategy implements ISwapStrategy {
  constructor(private targetPrice: number) {}

  async executeSwap(
    adapter: IDEXAdapter,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<string> {
    // const quote = await adapter.getQuote(fromToken, toToken, amount)

    // if (quote >= this.targetPrice) {
    //   return adapter.swap(fromToken, toToken, amount, 0.5)
    // } else {
    //   throw new Error(
    //     `Current quote (${quote}) < target price (${this.targetPrice})`
    //   )
    // }

    return ''
  }
}

export class RetailStrategy implements ISwapStrategy {
  constructor(private targetPrice: number) {}

  async executeSwap(
    adapter: IDEXAdapter,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<string> {
    // const quote = await adapter.getQuote(fromToken, toToken, amount)

    // if (quote >= this.targetPrice) {
    //   return adapter.swap(fromToken, toToken, amount, 0.5)
    // } else {
    //   throw new Error(
    //     `Current quote (${quote}) < target price (${this.targetPrice})`
    //   )
    // }

    return ''
  }
}

function addFeeToTx(
  tx: Transaction,
  from: PublicKey,
  feeAmount: bigint,
  service: {
    wallet: PublicKey
    percent: number
  },
  referrals: {
    wallet: PublicKey
    percent: number
  }[]
) {
  console.log('referral', referrals)

  if (feeAmount > 0n) {
    let amount = feeAmount

    for (const referral of referrals) {
      amount =
        (amount * BigInt(Math.floor(referral.percent * 100))) / PERCENT_BPS

      feeAmount -= amount

      if (amount > 0n) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: from,
            toPubkey: referral.wallet,
            lamports: amount + 890880n,
          })
        )
      }
    }

    if (feeAmount > 0n) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: from,
          toPubkey: service.wallet,
          lamports: feeAmount,
        })
      )
    }
  }
}
