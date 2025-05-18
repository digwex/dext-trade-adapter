import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { parseBigNumberish, u64 } from '@raydium-io/raydium-sdk-v2'
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { struct } from '@raydium-io/raydium-sdk-v2/lib/marshmallow/buffer-layout'

const ANCHUR_DATA_BUF = {
  initialize: [175, 175, 109, 31, 13, 152, 155, 237],
  deposit: [242, 35, 198, 137, 82, 225, 242, 182],
  withdraw: [183, 18, 70, 156, 148, 109, 161, 34],
  swapBaseInput: [143, 190, 90, 218, 196, 30, 51, 222],
  swapBaseOutput: [55, 217, 98, 86, 163, 74, 180, 173],
  lockCpLiquidity: [216, 157, 29, 78, 38, 51, 31, 26],
  collectCpFee: [8, 30, 51, 199, 209, 184, 247, 133],
}

const SWAP_IN_LAYOT = struct([u64('amountIn'), u64('amounOutMin')])

export function swapBaseIn(
  wallet: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  poolKeys: any,
  params: {
    amountIn: bigint
    minAmountOut: bigint
  }
): TransactionInstruction {
  const inputAta = getAssociatedTokenAddressSync(inputMint, wallet)
  const outputAta = getAssociatedTokenAddressSync(outputMint, wallet)

  let keys = [
    { pubkey: wallet, isSigner: true, isWritable: true },
    {
      pubkey: poolKeys.authority,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: poolKeys.configId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: poolKeys.poolId, isSigner: false, isWritable: true },
    { pubkey: inputAta, isSigner: false, isWritable: true },
    { pubkey: outputAta, isSigner: false, isWritable: true },

    // TODO: NEED CHECK DIRECT
    { pubkey: poolKeys.baseVault, isSigner: false, isWritable: true },
    { pubkey: poolKeys.quoteVault, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },

    {
      pubkey: inputMint,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: outputMint,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: poolKeys.observationId,
      isSigner: false,
      isWritable: true,
    },
  ]

  const data = Buffer.alloc(SWAP_IN_LAYOT.span)
  SWAP_IN_LAYOT.encode(
    {
      amountIn: parseBigNumberish(params.amountIn + ''),
      amounOutMin: parseBigNumberish(params.minAmountOut + ''),
    },
    data
  )

  return new TransactionInstruction({
    programId: poolKeys.programId,
    keys,
    data: Buffer.from([...ANCHUR_DATA_BUF.swapBaseInput, ...data]),
  })
}
