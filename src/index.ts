import { prepareWsolSwapInstructions } from "./blockchain/raydium";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as pumpSwap from "./instructions/pumpSwap";
import { getBuyAmountOut, getPool } from "./dex/pumpSwap";

import { sendVtx } from "./services/trade.service";
import { getSolanaConnection } from "./helpers/solana";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { initRaydiumSdk } from "./blockchain/raydium";

export interface IDEXAdapter {
  // send tx and return signature

  buy(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<string>;

  // send tx and return signature
  sell(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<string>;

  // send tx and return signature
  swap(
    fromToken: string,
    toToken: string,
    amount: number,
    slippage: number,
    by: "sell" | "buy"
  ): Promise<string>;

  // only instruction for sell without create ATA if posible for specific platfor pumpSwap, raydium, orca and other
  sellIx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction;

  // only instruction for buy without create ATA if posible for specific platfor pumpSwap, raydium, orca and other
  buyIx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction;

  // need for calc amount
  getQuote(
    fromToken: string,
    toToken: string,
    amount: number,
    by: "sell" | "buy"
  ): Promise<bigint>;
}

export class RaydiumAdapter implements IDEXAdapter {
  buy(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<string> {
    throw new Error("Method not implemented.");
  }
  sell(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<string> {
    throw new Error("Method not implemented.");
  }

  buyIx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction {
    throw new Error("Method not implemented.");
  }
  sellIx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction {
    throw new Error("Method not implemented.");
  }
  async getQuote(
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<bigint> {
    throw new Error("Method not implemented.");
  }

  async swap(
    fromToken: string,
    toToken: string,
    amount: number,
    slippage: number
  ): Promise<string> {
    // Генерация и отправка транзакции на Raydium
    return "0x123txhash";
  }

  async getPoolInfo(): Promise<any> {
    // Возврат информации о пулах
    return { pool: "RAY-USDC" };
  }
}

export class PumpSwapAdapter implements IDEXAdapter {
  buyIx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction {
    throw new Error("Method not implemented.");
  }
  sellIx(
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction {
    throw new Error("Method not implemented.");

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
  ): Promise<string> {
    const pool = getPool(inputMint, outputMint);

    const prepareWsol = await prepareWsolSwapInstructions(wallet.publicKey, 0n);

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
    });

    const tx = new Transaction()
      .add(...prepareWsol.instructionParams.instructions)
      .add(swapIx);

    if (prepareWsol.instructionParams.endInstructions.length > 0) {
      tx.add(...prepareWsol.instructionParams.endInstructions);
    }

    const sig = await sendVtx(wallet, tx, [wallet], true);

    return sig;

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
    const pool = getPool(inputMint, outputMint);

    const prepareWsol = await prepareWsolSwapInstructions(
      wallet.publicKey,
      amountIn
    );

    const connection = getSolanaConnection();

    if (amountOut == 0n) {
      amountOut = await getBuyAmountOut(
        connection,
        outputMint,
        amountIn,
        slippage
      );
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
    });

    const tx = new Transaction().add(
      ...prepareWsol.instructionParams.instructions
    );

    const ata = getAssociatedTokenAddressSync(outputMint, wallet.publicKey);

    try {
      await getAccount(connection, ata);
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
      );
    }

    tx.add(swapIx);

    if (prepareWsol.instructionParams.endInstructions.length > 0) {
      tx.add(...prepareWsol.instructionParams.endInstructions);
    }

    const sig = await sendVtx(wallet, tx, [wallet], true);

    return sig;
  }

  async swap(
    fromToken: string,
    toToken: string,
    amount: number,
    slippage: number
  ): Promise<string> {
    throw new Error("Method not implemented.");
  }

  async getQuote(
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<bigint> {
    // Подключение к Raydium API или on-chain quote
    throw new Error("Method not implemented.");
  }
}

export class DEXFactory {
  static create(dex: "raydium" | "orca" | "pumpswap"): IDEXAdapter {
    switch (dex) {
      case "pumpswap":
        return new PumpSwapAdapter();
      case "raydium":
        return new RaydiumAdapter();
      // case 'orca':
      //   return new OrcaAdapter()
      default:
        throw new Error(`Unsupported DEX: ${dex}`);
    }
  }
}

export interface ISwapStrategy {
  executeSwap(
    adapter: IDEXAdapter,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<string>; // returns txHash
}

export class MarketSwapStrategy implements ISwapStrategy {
  constructor(private slippage: number = 0.5) {}

  async executeSwap(
    adapter: IDEXAdapter,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<string> {
    return ""; // adapter.swap(fromToken, toToken, amount, this.slippage)
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

    return "";
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

    return "";
  }
}

export { initRaydiumSdk };
