import {
  Keypair,
  PublicKey,
  TransactionSignature,
} from "@solana/web3.js";

import { IDEXAdapter } from "../interfaces";

export abstract class Adapter implements IDEXAdapter {
  // Constants
  protected readonly PERCENT_BPS = 10_000n;
  
  // Service properties
  protected connection: any;
  protected rpc: string;

  protected constructor() {
    this.rpc = "https://api.devnet.solana.com";
    this.initializeConnection();
  }

  protected abstract initializeConnection(): void;
  
  abstract getQuote(
    fromToken: string, 
    toToken: string, 
    amount: bigint, 
    slippage: number
  ): Promise<bigint>;

  abstract swap(
    wallet: Keypair,
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number
  ): Promise<TransactionSignature>;

  buy = async (
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippage: number
  ): Promise<TransactionSignature> => {
    return this.swap(
      wallet,
      inputMint.toString(),
      outputMint.toString(),
      amount,
      slippage
    );
  };

  public sell = async (
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippage: number
  ): Promise<TransactionSignature> => {
    return this.swap(
      wallet,
      outputMint.toString(),
      inputMint.toString(),
      amount,
      slippage
    );
  };
}