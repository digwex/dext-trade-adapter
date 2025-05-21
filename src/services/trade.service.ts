import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  Transaction,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from '@solana/web3.js'

export async function sendVtx(
  connection: Connection,
  payer: Keypair,
  tx: Transaction | VersionedTransaction,
  signers: Keypair[],
  needCompute: boolean = false
): Promise<TransactionSignature> {
  const blockHash = await connection.getLatestBlockhash()

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

  const vTx = new VersionedTransaction(messageV0)

  vTx.sign(signers)

  // const simulate = await solanaConnection.simulateTransaction(vTx)

  // if (simulate.value.err) {
  //   console.log('err', simulate.value.err)
  //   // console.log('logs', simulate.value.logs)
  //   // console.log('return data', simulate.value.returnData)

  //   return {
  //     error: {
  //       msg:
  //         typeof simulate.value.err === 'string'
  //           ? simulate.value.err
  //           : extractErrorMessage(simulate.value.logs ?? []),
  //       type: 1,
  //     },
  //   }
  // }

  return await connection.sendTransaction(vTx);
}

function extractErrorMessage(logs: string[]): string {
  const errorLine = logs.find((line) => line.includes('Error Message:'))

  if (!errorLine) return 'Unknown error'

  const match = errorLine.match(/Error Message:\s*(.+)$/)
  return match ? match[1].trim() : 'Unknown error'
}
