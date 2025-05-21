import bs58 from "bs58";
import BN from "bn.js";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionSignature,
} from "@solana/web3.js";
import {
  AmmRpcData,
  AmmV4Keys,
  ApiV3PoolInfoStandardItem,
  DEVNET_PROGRAM_ID,
  liquidityStateV4Layout,
  Raydium,
} from "@raydium-io/raydium-sdk-v2";

import { IDEXAdapter } from "../interfaces";
import { sendVtx } from "../services";
import { RaydiumAdapter } from "./raydium-adapter";

export class RaydiumAmmAdapter extends RaydiumAdapter implements IDEXAdapter {
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

    let poolInfo: ApiV3PoolInfoStandardItem | undefined = pool.poolInfo
    let poolKeys: AmmV4Keys | undefined = pool.poolKeys
    let rpcData: AmmRpcData = pool.poolRpcData

    const [baseReserve, quoteReserve, status] = [rpcData.baseReserve, rpcData.quoteReserve, rpcData.status.toNumber()]

    const baseIn = inputMint.toString() === poolInfo.mintA.address
    const [mintIn, mintOut] = baseIn ? [poolInfo.mintA, poolInfo.mintB] : [poolInfo.mintB, poolInfo.mintA]

    const out = this.raydium.liquidity.computeAmountOut({
      poolInfo: {
        ...poolInfo,
        baseReserve,
        quoteReserve,
        status,
        version: 4,
      },
      amountIn: new BN(amount.toString()),
      mintIn: mintIn.address,
      mintOut: mintOut.address,
      slippage: slippage / 100,
    });

    this.raydium.setOwner(wallet)

    const { transaction } = await this.raydium.liquidity.swap({
      poolInfo,
      poolKeys,
      amountIn: new BN(amount.toString()),
      amountOut: out.minAmountOut,
      fixedSide: 'in',
      inputMint: mintIn.address,
      txVersion: RaydiumAdapter.txVersion,
    })

    return await sendVtx(this.connection, wallet, transaction, [wallet], true);
  }

  async getQuote(
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<bigint> {
    await this.init();

    const inputMint = new PublicKey(fromToken);
    const outputMint = new PublicKey(toToken);
    const pool = await this.getPool(inputMint, outputMint);

    let poolInfo: ApiV3PoolInfoStandardItem | undefined = pool.poolInfo
    let rpcData: AmmRpcData = pool.poolRpcData

    const [baseReserve, quoteReserve, status] = [rpcData.baseReserve, rpcData.quoteReserve, rpcData.status.toNumber()]

    const baseIn = inputMint.toString() === poolInfo.mintA.address
    const [mintIn, mintOut] = baseIn ? [poolInfo.mintA, poolInfo.mintB] : [poolInfo.mintB, poolInfo.mintA]

    const out = this.raydium.liquidity.computeAmountOut({
      poolInfo: {
        ...poolInfo,
        baseReserve,
        quoteReserve,
        status,
        version: 4,
      },
      amountIn: new BN(amount.toString()),
      mintIn: mintIn.address,
      mintOut: mintOut.address,
      slippage: slippage / 100,
    });

    return BigInt(out.amountOut.toString());
  }

  protected setConnection() {
    this.connection = new Connection(this.rpc, 'confirmed');
  }

  private async getPool(inputMint: PublicKey, outputMint: PublicKey) {
    const raydium = await Raydium.load(this.raydiumLoadParams);

    const baseFilter = {
      filters: [
        { dataSize: liquidityStateV4Layout.span },
        {
          memcmp: {
            offset: liquidityStateV4Layout.offsetOf('baseMint'),
            bytes: bs58.encode(Buffer.from(inputMint.toBytes())),
          },
        },
        {
          memcmp: {
            offset: liquidityStateV4Layout.offsetOf('quoteMint'),
            bytes: bs58.encode(Buffer.from(outputMint.toBytes())),
          }
        }
      ],
      encoding: 'base64',
    };

    const quoteFilter = {
      filters: [
        { dataSize: liquidityStateV4Layout.span },
        {
          memcmp: {
            offset: liquidityStateV4Layout.offsetOf('baseMint'),
            bytes: bs58.encode(Buffer.from(outputMint.toBytes())),
          },
        },
        {
          memcmp: {
            offset: liquidityStateV4Layout.offsetOf('quoteMint'),
            bytes: bs58.encode(Buffer.from(inputMint.toBytes())),
          }
        }
      ],
      encoding: 'base64',
    };

    const [baseMatches, quoteMatches] = await Promise.all([
      this.connection.getProgramAccounts(DEVNET_PROGRAM_ID.AmmV4, baseFilter),
      this.connection.getProgramAccounts(DEVNET_PROGRAM_ID.AmmV4, quoteFilter),
    ]);

    const combined = new Map<string, typeof baseMatches[0]>();

    [...baseMatches, ...quoteMatches].forEach(acc => {
      combined.set(acc.pubkey.toBase58(), acc);
    });

    const ammPools = Array.from(combined.keys());

    if (ammPools.length === 0) {
      throw new Error(`No Raydium AMM pool found for token pair ${inputMint.toBase58()} and ${outputMint.toBase58()}`);
    }

    return await raydium.liquidity.getPoolInfoFromRpc({ poolId: ammPools[0]});
  }
}