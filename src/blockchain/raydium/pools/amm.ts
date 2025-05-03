import {
  CpmmComputeData,
  CurveCalculator,
  ReturnTypeFetchMultipleMintInfos,
  WSOLMint,
} from '@raydium-io/raydium-sdk-v2'
import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

export interface IAmm {
  swapAmountBaseIn(amountIn: bigint, input: PublicKey): bigint
  swapAmountBaseOut(amountOut: bigint, input: PublicKey): bigint
}

export class AmmPool implements IAmm {
  reservePc: bigint
  reserveCoin: bigint
  pcNeedPnl: bigint
  coinNeedPnl: bigint
  swapFeeNumerator: bigint
  swapFeeDenominator: bigint

  constructor(
    reservePc: BN,
    reserveCoin: BN,
    pcNeedPnl: BN,
    coinNeedPnl: BN,
    swapFeeNumerator: BN,
    swapFeeDenominator: BN,
    readonly baseQuoute: PublicKey
  ) {
    if (baseQuoute !== WSOLMint) {
      ;[reservePc, reserveCoin] = [reserveCoin, reservePc]
      ;[pcNeedPnl, coinNeedPnl] = [coinNeedPnl, pcNeedPnl]
    }

    // console.log('base', baseQuoute)

    this.reservePc = BigInt(reservePc + '')
    this.reserveCoin = BigInt(reserveCoin + '')
    this.pcNeedPnl = BigInt(pcNeedPnl + '')
    this.coinNeedPnl = BigInt(coinNeedPnl + '')
    this.swapFeeNumerator = BigInt(swapFeeNumerator + '')
    this.swapFeeDenominator = BigInt(swapFeeDenominator + '')

    // console.log('pool state', {
    //   reservePc: this.reservePc,
    //   reserveCoin: this.reserveCoin,
    //   pcNeedPnl: this.pcNeedPnl,
    //   coinNeedPnl: this.coinNeedPnl,
    //   swapFeeNumerator: this.swapFeeNumerator,
    //   swapFeeDenominator: this.swapFeeDenominator,
    //   baseQuoute,
    // })
  }

  swapAmountBaseIn(amountIn: bigint, input: PublicKey): bigint {
    let amount_out

    const total_coin_without_take_pnl = this.reserveCoin - this.coinNeedPnl
    const total_pc_without_take_pnl = this.reservePc - this.pcNeedPnl

    let swap_fee = (amountIn * this.swapFeeNumerator) / this.swapFeeDenominator
    let swap_in_after_deduct_fee = amountIn - swap_fee

    if (input.equals(this.baseQuoute)) {
      // baseQuote - coin
      // (x + delta_x) * (y + delta_y) = x * y
      // (coin + amount_in) * (pc - amount_out) = coin * pc
      // => amount_out = pc - coin * pc / (coin + amount_in)
      // => amount_out = ((pc * coin + pc * amount_in) - coin * pc) / (coin + amount_in)
      // => amount_out =  pc * amount_in / (coin + amount_in)

      let denominator = total_coin_without_take_pnl + swap_in_after_deduct_fee
      amount_out =
        (total_pc_without_take_pnl * swap_in_after_deduct_fee) / denominator

      this.reserveCoin += amountIn
      this.reservePc -= amount_out
    } else {
      // pc->coin
      // (x + delta_x) * (y + delta_y) = x * y
      // (pc + amount_in) * (coin - amount_out) = coin * pc
      // => amount_out = coin - coin * pc / (pc + amount_in)
      // => amount_out = (coin * pc + coin * amount_in - coin * pc) / (pc + amount_in)
      // => amount_out = coin * amount_in / (pc + amount_in)

      let denominator = total_pc_without_take_pnl + swap_in_after_deduct_fee
      amount_out =
        (total_coin_without_take_pnl * swap_in_after_deduct_fee) / denominator

      this.reserveCoin -= amount_out
      this.reservePc += amountIn

      // console.log({
      //   reservePc: this.reservePc,
      //   reserveCoin: this.reserveCoin,
      //   amount_out,
      //   swap_in_after_deduct_fee,
      // })
    }

    return amount_out
  }

  swapAmountBaseOut(amountOut: bigint, input: PublicKey): bigint {
    let amount_in

    const total_coin_without_take_pnl = this.reserveCoin - this.coinNeedPnl
    const total_pc_without_take_pnl = this.reservePc - this.pcNeedPnl

    if (input.equals(this.baseQuoute)) {
      // (x + delta_x) * (y + delta_y) = x * y
      // (coin + amount_in) * (pc - amount_out) = coin * pc
      // => amount_out = pc - coin * pc / (coin + amount_in)
      // => amount_out = ((pc * coin + pc * amount_in) - coin * pc) / (coin + amount_in)
      // => amount_out =  pc * amount_in / (coin + amount_in)

      let denominator = total_pc_without_take_pnl - amountOut
      const beforeAddFee =
        (total_coin_without_take_pnl * amountOut) / denominator

      amount_in =
        (beforeAddFee * this.swapFeeDenominator) /
        (this.swapFeeDenominator - this.swapFeeNumerator)

      this.reserveCoin += amount_in
      this.reservePc -= amountOut
    } else {
      // (x + delta_x) * (y + delta_y) = x * y
      // (pc + amount_in) * (coin - amount_out) = coin * pc
      // => amount_out = coin - coin * pc / (pc + amount_in)
      // => amount_out = (coin * pc + coin * amount_in - coin * pc) / (pc + amount_in)
      // => amount_out = coin * amount_in / (pc + amount_in)

      let denominator = total_coin_without_take_pnl - amountOut

      const beforeAddFee = (total_pc_without_take_pnl * amountOut) / denominator

      amount_in =
        (beforeAddFee * this.swapFeeDenominator) /
        (this.swapFeeDenominator - this.swapFeeNumerator)

      this.reserveCoin -= amountOut
      this.reservePc += amount_in
    }

    return amount_in
  }
}

export class CpmmPool implements IAmm {
  readonly mintA: PublicKey
  readonly mintB: PublicKey
  constructor(
    readonly pool: CpmmComputeData,
    readonly mintInfos: ReturnTypeFetchMultipleMintInfos
  ) {
    this.mintA = new PublicKey(pool.mintA.address)
    this.mintB = new PublicKey(pool.mintB.address)
  }

  swapAmountBaseIn(amountIn: bigint, input: PublicKey): bigint {
    let [total_input_token_amount, total_output_token_amount] =
      this.vaultAmountWithoutFee(
        BigInt(this.pool.vaultAAmount + ''),
        BigInt(this.pool.vaultBAmount + '')
      )

    if (input.equals(this.mintB)) {
      ;[total_input_token_amount, total_output_token_amount] = [
        total_output_token_amount,
        total_input_token_amount,
      ]
    }

    let result = CurveCalculator.swap(
      new BN(amountIn + ''),
      new BN(total_input_token_amount + ''),
      new BN(total_output_token_amount + ''),
      this.pool.configInfo.tradeFeeRate
    )

    let amount_out = result.destinationAmountSwapped
    let transfer_fee = new BN(0)
    let amountOut = amount_out.sub(transfer_fee)

    return BigInt(amountOut + '')
  }

  swapAmountBaseOut(amountOut: bigint, input: PublicKey): bigint {
    // let [total_input_token_amount, total_output_token_amount] =
    //   this.vaultAmountWithoutFee(
    //     BigInt(this.pool.vaultAAmount + ''),
    //     BigInt(this.pool.vaultBAmount + '')
    //   )

    // if (input.equals(this.mintB)) {
    //   ;[total_input_token_amount, total_output_token_amount] = [
    //     total_output_token_amount,
    //     total_input_token_amount,
    //   ]
    // }

    let result = CurveCalculator.swapBaseOut({
      poolMintA: this.pool.mintA,
      poolMintB: this.pool.mintB,
      baseReserve: this.pool.baseReserve,
      quoteReserve: this.pool.quoteReserve,
      outputAmount: new BN(amountOut + ''),
      tradeFeeRate: this.pool.configInfo.tradeFeeRate,
      outputMint: input.equals(this.mintA) ? this.mintB : this.mintA,
    })

    return BigInt(result.amountIn + '')
  }

  private vaultAmountWithoutFee(
    vault0: bigint,
    vault1: bigint
  ): [bigint, bigint] {
    const vault0WithoutFee =
      vault0 -
      BigInt(this.pool.protocolFeesMintA.add(this.pool.fundFeesMintA) + '')
    const vault1WithoutFee =
      vault1 -
      BigInt(this.pool.protocolFeesMintB.add(this.pool.fundFeesMintB) + '')

    if (vault0WithoutFee < BigInt(0) || vault1WithoutFee < BigInt(0)) {
      throw new Error('Vault amounts cannot be negative after fee subtraction')
    }

    return [vault0WithoutFee, vault1WithoutFee]
  }

  private tokenPriceX32(vault0: bigint, vault1: bigint): [bigint, bigint] {
    const Q32 = BigInt(2 ** 32) // Fixed-point scaling factor
    const [token0Amount, token1Amount] = this.vaultAmountWithoutFee(
      vault0,
      vault1
    )

    if (token0Amount === BigInt(0) || token1Amount === BigInt(0)) {
      throw new Error('Division by zero in token price calculation')
    }

    const priceToken1InX32 = (token1Amount * Q32) / token0Amount
    const priceToken0InX32 = (token0Amount * Q32) / token1Amount

    return [priceToken1InX32, priceToken0InX32]
  }
}
