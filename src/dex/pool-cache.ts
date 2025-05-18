import { PublicKey } from '@solana/web3.js'

export interface IPoolCache<T> {
  write(id: PublicKey, data: T): Promise<void>
  read(id: PublicKey): Promise<T>
}

export enum RaydiumPoolType {
  AMM = 'AMM',
  AMM_STABLE = 'AMM Stable',
  CLMM = 'CLMM',
  CPMM = 'CPMM',
}

export interface RaydiumPool {
  id: PublicKey
  keys: any
  data: any
  type: RaydiumPoolType
  version: number
}

export interface PumpSwapPool {
  id: PublicKey
  keys: any
  data: any
}

// export class RaydiumPoolCache<T> implements IPoolCache<T> {
//   async write(id: PublicKey, data: T): Promise<void> {
//     const idStr = id + ''
//   }
//   read(id: PublicKey): Promise<T> {
//     throw new Error('Method not implemented.')
//   }
// }
