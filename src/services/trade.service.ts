import {
  ComputeBudgetProgram,
  Keypair,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import { getSolanaConnection } from '../helpers/solana'

export async function sendVtx(
  payer: Keypair,
  tx: Transaction,
  signers: Keypair[],
  needCompute: boolean = false
): Promise<string> {
  const solanaConnection = getSolanaConnection()
  const blockHash = await solanaConnection.getLatestBlockhash()

  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockHash.blockhash,
    instructions: tx.instructions, // Include the instructions from the transaction
  }).compileToV0Message() // Use [] if no address lookup tables are used

  if (needCompute) {
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100000,
      })
    )
  }

  // Wrap into VersionedTransaction
  const vTx = new VersionedTransaction(messageV0)

  vTx.sign(signers)

  // const simulate = await solanaConnection.simulateTransaction(vTx)

  // if (simulate.value.err) {
  //   throw simulate.value.err
  // }

  const result = await solanaConnection.sendTransaction(vTx)

  return result
}
