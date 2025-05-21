import bs58 from "bs58";
import BN from "bn.js";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionSignature,
} from "@solana/web3.js";
import {
  ApiV3PoolInfoStandardItemCpmm,
  CpmmKeys,
  CpmmPoolInfoLayout,
  CpmmRpcData,
  CurveCalculator,
  DEVNET_PROGRAM_ID,
  PoolInfoLayout,
} from "@raydium-io/raydium-sdk-v2";

import { sendVtx } from "../services";
import { IDEXAdapter } from "../interfaces";
import { RaydiumAdapter } from "./raydium-adapter";

export class RaydiumCpmmAdapter extends RaydiumAdapter implements IDEXAdapter {
  constructor() {
    super();
  }

  async swap(
    wallet: Keypair,
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<TransactionSignature> {
    await this.init();

    const tokenIn = new PublicKey(fromToken);
    const tokenOut = new PublicKey(toToken);
    
    const poolData = await this.fetchPoolData(tokenIn, tokenOut);
    
    const { poolInfo, poolKeys, rpcData } = poolData;
    
    const isBaseTokenIn = tokenIn.toString() === poolInfo.mintA.address;
    
    const swapCalculation = CurveCalculator.swap(
      new BN(amount.toString()),
      isBaseTokenIn ? rpcData.baseReserve : rpcData.quoteReserve,
      isBaseTokenIn ? rpcData.quoteReserve : rpcData.baseReserve,
      rpcData.configInfo!.tradeFeeRate
    );

    this.raydium.setOwner(wallet);
    
    const { transaction } = await this.raydium.cpmm.swap({
      poolInfo,
      poolKeys,
      inputAmount: new BN(amount.toString()),
      swapResult: swapCalculation,
      slippage: slippage / 100,
      baseIn: isBaseTokenIn,
      txVersion: RaydiumAdapter.txVersion,
    });

    return await sendVtx(this.connection, wallet, transaction, [wallet], true);
  }

  async getQuote(
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<bigint> {
    const tokenIn = new PublicKey(fromToken);
    const tokenOut = new PublicKey(toToken);
    
    const poolData = await this.fetchPoolData(tokenIn, tokenOut);
    
    const { poolInfo, rpcData } = poolData;
    
    const isBaseTokenIn = tokenIn.toString() === poolInfo.mintA.address;
    
    const swapCalculation = CurveCalculator.swap(
      new BN(amount.toString()),
      isBaseTokenIn ? rpcData.baseReserve : rpcData.quoteReserve,
      isBaseTokenIn ? rpcData.quoteReserve : rpcData.baseReserve,
      rpcData.configInfo!.tradeFeeRate
    );

    return BigInt(swapCalculation.destinationAmountSwapped.toString());
  }

  protected initializeConnection(): void {
    this.connection = new Connection(this.rpc, 'confirmed');
  }

  private async fetchPoolData(tokenA: PublicKey, tokenB: PublicKey) {
    await this.init();

    const baseFilter = this.createPoolFilter(tokenA, tokenB);
    
    const quoteFilter = this.createPoolFilter(tokenB, tokenA);

    const [baseMatches, quoteMatches] = await Promise.all([
      this.connection.getProgramAccounts(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, baseFilter),
      this.connection.getProgramAccounts(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, quoteFilter),
    ]);

    const uniquePools = new Map<string, typeof baseMatches[0]>();
    [...baseMatches, ...quoteMatches].forEach(account => {
      uniquePools.set(account.pubkey.toBase58(), account);
    });

    const availablePools = Array.from(uniquePools.keys());

    if (availablePools.length === 0) {
      throw new Error(
        `No Raydium CPMM pool found for token pair ${tokenA.toBase58()} and ${tokenB.toBase58()}`
      );
    }

    return await this.raydium.cpmm.getPoolInfoFromRpc(availablePools[0]);
  }

  private createPoolFilter(base: PublicKey, quote: PublicKey) {
    return {
      filters: [
        { dataSize: CpmmPoolInfoLayout.span },
        {
          memcmp: {
            offset: CpmmPoolInfoLayout.offsetOf('mintA'),
            bytes: bs58.encode(Buffer.from(base.toBytes())),
          },
        },
        {
          memcmp: {
            offset: CpmmPoolInfoLayout.offsetOf('mintB'),
            bytes: bs58.encode(Buffer.from(quote.toBytes())),
          }
        },
        {
          memcmp: {
            offset: PoolInfoLayout.offsetOf('status'),
            bytes: bs58.encode(Buffer.from([0])),
          }
        }
      ],
      encoding: 'base64',
    };
  }
}