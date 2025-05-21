import { 
  MeteoraDlmmAdapter, 
  PumpSwapAdapter, 
  RaydiumAmmAdapter, 
  RaydiumCpmmAdapter 
} from "./adapters";
import { IDEXAdapter } from "./interfaces";

export class DEXFactory {
  static create<T>(
    dex: 'raydium-amm' | 'raydium-cpmm' | 'orca' | 'pumpswap' | 'meteora',
  ): IDEXAdapter {
    switch (dex) {
      case 'pumpswap':
        return new PumpSwapAdapter();
      case 'raydium-amm': {
        return new RaydiumAmmAdapter();
      }
      case 'raydium-cpmm': {
        return new RaydiumCpmmAdapter();
      }
      // case 'orca':
      //   return new OrcaAdapter()
      case 'meteora':
        return new MeteoraDlmmAdapter();
      default:
        throw new Error(`Unsupported DEX: ${dex}`);
    }
  }
}

export interface ISwapStrategy {
  executeSwap(
    adapter: IDEXAdapter,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<string> // returns txHash
}

export class MarketSwapStrategy implements ISwapStrategy {
  constructor(private slippage: number = 0.5) {}

  async executeSwap(
    adapter: IDEXAdapter,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<string> {
    return '' // adapter.swap(fromToken, toToken, amount, this.slippage)
  }
}

export class LimitSwapStrategy implements ISwapStrategy {
  constructor(private targetPrice: number) {}

  async executeSwap(
    adapter: IDEXAdapter,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<string> {
    // const quote = await adapter.getQuote(fromToken, toToken, amount)

    // if (quote >= this.targetPrice) {
    //   return adapter.swap(fromToken, toToken, amount, 0.5)
    // } else {
    //   throw new Error(
    //     `Current quote (${quote}) < target price (${this.targetPrice})`
    //   )
    // }

    return ''
  }
}

export class RetailStrategy implements ISwapStrategy {
  constructor(private targetPrice: number) {}

  async executeSwap(
    adapter: IDEXAdapter,
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<string> {
    // const quote = await adapter.getQuote(fromToken, toToken, amount)

    // if (quote >= this.targetPrice) {
    //   return adapter.swap(fromToken, toToken, amount, 0.5)
    // } else {
    //   throw new Error(
    //     `Current quote (${quote}) < target price (${this.targetPrice})`
    //   )
    // }

    return ''
  }
}
