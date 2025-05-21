import {
  Keypair,
  PublicKey,
  TransactionSignature,
} from "@solana/web3.js";

import { IDEXAdapter } from "../interfaces";

export abstract class Adapter implements IDEXAdapter {
  protected PERCENT_BPS = 10_000n;
  // TODO: Refactor to get/set
  protected connection: any;
  protected rpc: any;

  protected constructor() {
    this.rpc = "https://api.devnet.solana.com";
    this.setConnection();
  }

  protected abstract setConnection(): void;

  buy(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippage: number
  ): Promise<TransactionSignature> {
    return this.swap(
      wallet,
      inputMint.toString(),
      outputMint.toString(),
      amount,
      slippage,
    );
  }

  sell(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippage: number
  ): Promise<TransactionSignature> {
    return this.swap(
      wallet,
      outputMint.toString(),
      inputMint.toString(),
      amount,
      slippage,
    );
  }

  abstract getQuote(
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<bigint>;

  abstract swap (
    wallet: Keypair,
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<TransactionSignature>;
}