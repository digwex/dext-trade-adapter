import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js'

import {
  closeAccountInstruction,
  InstructionType,
  WSOLMint,
} from '@raydium-io/raydium-sdk-v2'

export async function prepareWsolSwapInstructions(
  connection: Connection,
  wallet: PublicKey,
  amountWSol: bigint
): Promise<{
  ata: PublicKey
  instructionParams: {
    instructions: TransactionInstruction[]
    endInstructions: TransactionInstruction[]
    instructionTypes: string[]
    endInstructionTypes: string[]
  }
}> {
  // const newTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey)

  const ata = getAssociatedTokenAddressSync(
    WSOLMint,
    wallet,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  const accountInfo = await connection.getAccountInfo(ata)

  const instructions: TransactionInstruction[] = []
  const endInstructions: TransactionInstruction[] = []
  const instructionTypes: string[] = []

  if (!accountInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        wallet, // Payer (will fund the creation)
        ata, // Associated Token Account to create
        wallet, // The wallet owner of the account
        WSOLMint, // The token mint for WSOL or any SPL token
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )

    instructionTypes.push(InstructionType.InitAccount)
  }

  if (amountWSol > 0n) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: wallet,
        toPubkey: ata,
        lamports: amountWSol,
      })
    )
    instructionTypes.push(InstructionType.TransferAmount)
  }

  if (!accountInfo || amountWSol > 0n) {
    // Step 5: Sync the native token balance (required to mark as WSOL)
    instructions.push(createSyncNativeInstruction(ata, TOKEN_PROGRAM_ID))
    instructionTypes.push('MarkWSOL')
  }

  endInstructions.push(
    closeAccountInstruction({
      owner: wallet,
      payer: wallet,
      tokenAccount: ata,
      programId: TOKEN_PROGRAM_ID,
    })
  )

  return {
    ata,
    instructionParams: {
      instructions,
      endInstructions,
      instructionTypes,
      endInstructionTypes: [InstructionType.CloseAccount],
    },
  }
}
