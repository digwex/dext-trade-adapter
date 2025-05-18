import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { parseBigNumberish, struct, u64, u8 } from '@raydium-io/raydium-sdk-v2'
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

const LAYOUT_SWAP_IN = struct([
  u8('instruction'),
  u64('amountIn'),
  u64('minAmountOut'),
])

export async function swapIn(
  wallet: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  poolKeys: any,
  params: {
    amountIn: bigint
    minAmountOut: bigint
  }
): Promise<TransactionInstruction> {
  const data = Buffer.alloc(LAYOUT_SWAP_IN.span)
  LAYOUT_SWAP_IN.encode(
    {
      instruction: 9,
      amountIn: parseBigNumberish(params.amountIn + ''),
      minAmountOut: parseBigNumberish(params.minAmountOut + ''),
    },
    data
  )

  const inputAta = getAssociatedTokenAddressSync(inputMint, wallet)
  const outputAta = getAssociatedTokenAddressSync(outputMint, wallet)

  const keys = [
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: poolKeys.id, isWritable: true, isSigner: false },
    { pubkey: poolKeys.authority, isWritable: false, isSigner: false },
    { pubkey: poolKeys.openOrders, isWritable: true, isSigner: false },
    { pubkey: poolKeys.targetOrders, isWritable: true, isSigner: false },
    { pubkey: poolKeys.baseVault, isWritable: true, isSigner: false },
    { pubkey: poolKeys.quoteVault, isWritable: true, isSigner: false },
    { pubkey: poolKeys.marketProgramId, isWritable: false, isSigner: false },
    { pubkey: poolKeys.marketId, isWritable: true, isSigner: false },
    { pubkey: poolKeys.marketBids, isWritable: true, isSigner: false },
    { pubkey: poolKeys.marketAsks, isWritable: true, isSigner: false },
    { pubkey: poolKeys.marketEventQueue, isWritable: true, isSigner: false },
    { pubkey: poolKeys.marketBaseVault, isWritable: true, isSigner: false },
    { pubkey: poolKeys.marketQuoteVault, isWritable: true, isSigner: false },
    { pubkey: poolKeys.marketAuthority, isWritable: false, isSigner: false },
    { pubkey: inputAta, isWritable: true, isSigner: false },
    { pubkey: outputAta, isWritable: true, isSigner: false },
    { pubkey: wallet, isWritable: false, isSigner: true },
  ]

  return new TransactionInstruction({
    programId: poolKeys.programId,
    keys,
    data,
  })
}
