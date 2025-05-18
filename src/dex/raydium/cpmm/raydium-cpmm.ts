import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js'
import { swapBaseIn } from './instructions'
import { CurveCalculator, parseBigNumberish } from '@raydium-io/raydium-sdk-v2'
import { AccountLayout } from '@solana/spl-token'
import BN from 'bn.js'
import { IPoolCache, RaydiumPool } from '../../pool-cache'

const PRECISSIONS = 1_000_000_000
const PRECISSIONS_BN = new BN(PRECISSIONS)

export class RaydiumCpmm {
  constructor(
    private readonly cache: IPoolCache<RaydiumPool>,
    private readonly getConnection: () => Connection
  ) {}

  public async swap(
    walet: PublicKey,
    poolId: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    slippage: number
  ): Promise<void> {}

  public async swapIx(
    walet: PublicKey,
    poolId: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    amountOut: bigint,
    poolKeys?: {}
  ): Promise<TransactionInstruction> {
    if (!poolKeys) {
      const poolData = await this.cache.read(poolId)

      poolKeys = poolData.keys
    }

    const ix = swapBaseIn(walet, inputMint, outputMint, poolKeys, {
      amountIn,
      minAmountOut: amountOut,
    })

    return ix
  }

  public async getReserves(
    poolId: PublicKey,
    cache?: RaydiumPool
  ): Promise<[bigint, bigint]> {
    cache ??= await this.cache.read(poolId)

    const keys = cache.keys
    const connection = this.getConnection()
    const info = await connection.getMultipleAccountsInfo([
      keys.vaultA,
      keys.vaultB,
    ])

    const baseReserve = new BN(AccountLayout.decode(info[0]!.data).amount + '')
      .sub(keys.protocolFeesMintA)
      .sub(keys.fundFeesMintA)
    const quoteReserve = new BN(AccountLayout.decode(info[1]!.data).amount + '')
      .sub(keys.protocolFeesMintB)
      .sub(keys.fundFeesMintB)

    return [BigInt(baseReserve + ''), BigInt(quoteReserve + '')] // baseReserve, quouteReserve
  }

  public async getQuote(
    poolId: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippage: number = 1
  ) {
    const info = await this.cache.read(poolId)

    const reserves = await this.getReserves(poolId, info)

    const baseIn = inputMint + '' === info.keys.mintA + ''

    const result = CurveCalculator.swap(
      parseBigNumberish(amount),
      parseBigNumberish(baseIn ? reserves[0] : reserves[1]),
      parseBigNumberish(baseIn ? reserves[1] : reserves[0]),
      info.data.configInfo.tradeFeeRate
    )

    const slippageFactorFloat = 1 - (slippage / 100) * PRECISSIONS
    const slippageFactor = new BN(Math.floor(slippageFactorFloat))

    return BigInt(
      result.destinationAmountSwapped.mul(slippageFactor).div(PRECISSIONS_BN) +
        ''
    )
  }
}
