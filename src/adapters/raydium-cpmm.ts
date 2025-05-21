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

    const inputMint = new PublicKey(fromToken);
    const outputMint = new PublicKey(toToken);
    const pool = await this.getPool(inputMint, outputMint);

    const poolInfo: ApiV3PoolInfoStandardItemCpmm = pool.poolInfo
    const poolKeys: CpmmKeys | undefined = pool.poolKeys
    const rpcData: CpmmRpcData = pool.rpcData

    const baseIn = inputMint.toString() === poolInfo.mintA.address

    const swapResult = CurveCalculator.swap(
      new BN(amount.toString()),
      baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
      baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
      rpcData.configInfo!.tradeFeeRate
    )

    this.raydium.setOwner(wallet)
    const { transaction } = await this.raydium.cpmm.swap({
      poolInfo,
      poolKeys,
      inputAmount: new BN(amount.toString()),
      swapResult,
      slippage: slippage / 100,
      baseIn,
      txVersion: RaydiumAdapter.txVersion,
    })

    return await sendVtx(this.connection, wallet, transaction, [wallet], true)
  }

  async getQuote(
    fromToken: string,
    toToken: string,
    amount: bigint,
  ): Promise<bigint> {
    const inputMint = new PublicKey(fromToken);
    const outputMint = new PublicKey(toToken);
    const pool = await this.getPool(inputMint, outputMint);

    const poolInfo: ApiV3PoolInfoStandardItemCpmm = pool.poolInfo
    const rpcData: CpmmRpcData = pool.rpcData

    const baseIn = inputMint.toString() === poolInfo.mintA.address

    const swapResult = CurveCalculator.swap(
      new BN(amount.toString()),
      baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
      baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
      rpcData.configInfo!.tradeFeeRate
    )

    return BigInt(swapResult.destinationAmountSwapped.toString());
  }

  protected setConnection() {
    this.connection = new Connection(this.rpc, 'confirmed');
  }

  private async getPool(inputMint: PublicKey, outputMint: PublicKey) {
    await this.init();

    const baseFilter = {
      filters: [
        { dataSize: CpmmPoolInfoLayout.span },
        {
          memcmp: {
            offset: CpmmPoolInfoLayout.offsetOf('mintA'),
            bytes: bs58.encode(Buffer.from(inputMint.toBytes())),
          },
        },
        {
          memcmp: {
            offset: CpmmPoolInfoLayout.offsetOf('mintB'),
            bytes: bs58.encode(Buffer.from(outputMint.toBytes())),
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

    const quoteFilter = {
      filters: [
        { dataSize: CpmmPoolInfoLayout.span },
        {
          memcmp: {
            offset: CpmmPoolInfoLayout.offsetOf('mintA'),
            bytes: bs58.encode(Buffer.from(outputMint.toBytes())),
          },
        },
        {
          memcmp: {
            offset: CpmmPoolInfoLayout.offsetOf('mintB'),
            bytes: bs58.encode(Buffer.from(inputMint.toBytes())),
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

    const [baseMatches, quoteMatches] = await Promise.all([
      this.connection.getProgramAccounts(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, baseFilter),
      this.connection.getProgramAccounts(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, quoteFilter),
    ]);

    const combined = new Map<string, typeof baseMatches[0]>();

    [...baseMatches, ...quoteMatches].forEach(acc => {
      combined.set(acc.pubkey.toBase58(), acc);
    });

    const cpmmPools = Array.from(combined.keys());

    if (cpmmPools.length === 0) {
      throw new Error(`No Raydium CPMM pool found for token pair ${inputMint.toBase58()} and ${outputMint.toBase58()}`);
    }

    return await this.raydium.cpmm.getPoolInfoFromRpc(cpmmPools[0])
  }
}