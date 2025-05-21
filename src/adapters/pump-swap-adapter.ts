import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionSignature,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';

import { prepareWsolSwapInstructions } from "../helpers/solana.helpers";
import { getBuyAmountOut, getPool, getSellAmountOut } from "../dex/pumpSwap";
import * as pumpSwap from '../instructions/pumpSwap';
import { IDEXAdapter } from "../interfaces";
import { Adapter } from "./adapter";
import { sendVtx } from "../services";

export class PumpSwapAdapter extends Adapter implements IDEXAdapter {
  constructor() {
    super();
  }

  protected setConnection() {
    this.connection = new Connection(this.rpc, 'confirmed');
  }

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
  ): Promise<TransactionSignature> {
    const pool = await getPool(this.connection, inputMint, outputMint)

    const prepareWsol = await prepareWsolSwapInstructions(
      this.connection,
      wallet.publicKey,
      0n
    )

    if (amountOut === 0n) {
      amountOut = await getSellAmountOut(
        this.connection,
        inputMint,
        amountIn,
        slippage
      )
    }

    const feeAmount =
      (amountOut * BigInt(Math.floor(serviceFee.percent * 100))) / this.PERCENT_BPS +
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

    this.addFeeToTx(tx, wallet.publicKey, feeAmount, serviceFee, referralsFee)

    const result = await sendVtx(this.connection, wallet, tx, [wallet], true);

    return result;
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
  ): Promise<TransactionSignature> {
    const pool = await getPool(this.connection, inputMint, outputMint)

    const feeAmount =
      (amountIn * BigInt(Math.floor(serviceFee.percent * 100))) / this.PERCENT_BPS +
      890880n * BigInt(referralsFee.length) // 1e6 * 1.5 * 100 / 10000

    amountIn -= feeAmount

    const prepareWsol = await prepareWsolSwapInstructions(
      this.connection,
      wallet.publicKey,
      amountIn
    )

    if (amountOut == 0n) {
      amountOut = await getBuyAmountOut(
        this.connection,
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
      await getAccount(this.connection, ata)
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

    this.addFeeToTx(tx, wallet.publicKey, feeAmount, serviceFee, referralsFee)

    const result = await sendVtx(this.connection, wallet, tx, [wallet], true)

    return result
  }

  buyIx (
    wallet: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint
  ): TransactionInstruction {
    throw new Error('Method not implemented.')
  }

  sellIx (
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

  async swap(
    wallet: Keypair,
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<TransactionSignature> {
    throw new Error('Method not implemented.')
  }

  async getQuote(
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<bigint> {
    // Подключение к Raydium API или on-chain quote
    throw new Error('Method not implemented.')
  }

  private addFeeToTx(
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
          (amount * BigInt(Math.floor(referral.percent * 100))) / this.PERCENT_BPS
  
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
}
