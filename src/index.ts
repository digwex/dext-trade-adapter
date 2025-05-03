import { prepareWsolSwapInstructions } from './blockchain/raydium'
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import * as pumpSwap from './instructions/pumpSwap'
import { getBuyAmountOut, getPool } from './dex/pumpSwap'

import { sendVtx } from './services/trade.service'
import { getSolanaConnection } from './helpers/solana'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'

export interface ISwapStrategy {
  executeSwap(
    adapter: IDEXAdapter,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<string> // returns txHash
}

export interface IDEXAdapter {
  buy(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<string>

  sell(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<string>

  swap(
    fromToken: string,
    toToken: string,
    amount: number,
    slippage: number,
    by: 'sell' | 'buy'
  ): Promise<string>

  getQuote(
    fromToken: string,
    toToken: string,
    amount: number,
    by: 'sell' | 'buy'
  ): Promise<number>

  retailSellIx(
    seller: PublicKey,
    mint: PublicKey,
    amount: bigint,
    wex?: {
      lamports: bigint
      index: number
      owner: PublicKey
    }
  ): TransactionInstruction

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
  ): TransactionInstruction

  sellIx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction

  /**
   * Получить информацию о пулах и поддерживаемых парах
   */
  getPoolInfo(): Promise<any>

  rugIx(wallet: PublicKey, mint: PublicKey): TransactionInstruction
}

export class RaydiumAdapter implements IDEXAdapter {
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
  buy(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<string> {
    throw new Error('Method not implemented.')
  }
  sell(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<string> {
    throw new Error('Method not implemented.')
  }
  async getQuote(
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<number> {
    // Подключение к Raydium API или on-chain quote
    return 123.45
  }

  async swap(
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
  rugIx(wallet: PublicKey, mint: PublicKey): TransactionInstruction {
    throw new Error('Method not implemented.')

    // const pool = getPool(mint, WSOLMint)
    // const ix = pumpSwapRug(wallet, pool)

    // return ix
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

    // const pool = getPool(mint, WSOLMint)
    // const ix = pumpSwapRetailBuyIx(buyer, collect, mint, fees, pool, wex)

    // return ix
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

    // const pool = getPool(mint, WSOLMint)

    // const ix = pumpSwapRetailSellIx(seller, mint, amount, pool, wex)

    // return ix
  }
  async sell(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<string> {
    const pool = getPool(inputMint, outputMint)

    const prepareWsol = await prepareWsolSwapInstructions(wallet.publicKey, 0n)

    const swapIx = pumpSwap.sellIx({
      poolKeys: {
        poolId: pool.id,
        baseMint: inputMint,
        qouteMint: outputMint,
        poolBaseAta: pool.baseAta,
        poolQouteAta: pool.quoteAta,
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

    const sig = await sendVtx(wallet, tx, [wallet], true)

    return sig

    // throw new Error('Method not implemented.')
  }

  async buy(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<string> {
    const pool = getPool(inputMint, outputMint)

    const prepareWsol = await prepareWsolSwapInstructions(
      wallet.publicKey,
      amountIn
    )

    const connection = getSolanaConnection()

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

    const sig = await sendVtx(wallet, tx, [wallet], true)

    return sig
  }
  async getQuote(
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<number> {
    // Подключение к Raydium API или on-chain quote
    return 123.45
  }

  async swap(
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

export class DEXFactory {
  static create(dex: 'raydium' | 'orca' | 'pumpswap'): IDEXAdapter {
    switch (dex) {
      case 'pumpswap':
        return new PumpSwapAdapter()
      case 'raydium':
        return new RaydiumAdapter()
      // case 'orca':
      //   return new OrcaAdapter()
      default:
        throw new Error(`Unsupported DEX: ${dex}`)
    }
  }
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

// amount = [0.75, 0.9, 0.98, 0.95, 1.2, 0.85, 1, 2, 3, 5]

// buy 1 -> spec-wallet1
// buy 1 -> spec-wallet1
// buy 1 -> spec-wallet1
// buy 1 -> spec-wallet1

// tx
//    buy 1 -> spec-wallet1
//    sell 0.8

// --
// sell from spec-wallet1
// sell from spec-wallet1
// sell from spec-wallet1
