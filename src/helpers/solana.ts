import { Connection } from '@solana/web3.js'
import { RPC_URLS } from '../constants'
import { generateRandomInteger } from './generate-random-number'

export const getSolanaConnection = () => {
  let index = generateRandomInteger(0, RPC_URLS.length - 1)

  if (typeof index === 'undefined') {
    index = 0
  }

  const rpc = RPC_URLS[index]
  return new Connection(rpc)
}
