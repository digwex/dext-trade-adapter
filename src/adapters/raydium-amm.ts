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

    const tokenInMint = new PublicKey(fromToken);
    const tokenOutMint = new PublicKey(toToken);
    
    const poolDetails = await this.findLiquidityPool(tokenInMint, tokenOutMint);

    const { poolInfo, poolKeys, poolRpcData: rpcData } = poolDetails;
    
    const { baseReserve, quoteReserve, status } = {
      baseReserve: rpcData.baseReserve,
      quoteReserve: rpcData.quoteReserve,
      status: rpcData.status.toNumber()
    };

    const isBaseTokenInput = tokenInMint.toString() === poolInfo.mintA.address;
    
    const [inputMintInfo, outputMintInfo] = isBaseTokenInput 
      ? [poolInfo.mintA, poolInfo.mintB] 
      : [poolInfo.mintB, poolInfo.mintA];

    const outputAmountData = this.raydium.liquidity.computeAmountOut({
      poolInfo: {
        ...poolInfo,
        baseReserve,
        quoteReserve,
        status,
        version: 4,
      },
      amountIn: new BN(amount.toString()),
      mintIn: inputMintInfo.address,
      mintOut: outputMintInfo.address,
      slippage: slippage / 100,
    });

    this.raydium.setOwner(wallet);

    const { transaction } = await this.raydium.liquidity.swap({
      poolInfo,
      poolKeys,
      amountIn: new BN(amount.toString()),
      amountOut: outputAmountData.minAmountOut,
      fixedSide: 'in',
      inputMint: inputMintInfo.address,
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
    await this.init();

    const tokenInMint = new PublicKey(fromToken);
    const tokenOutMint = new PublicKey(toToken);
    
    const poolDetails = await this.findLiquidityPool(tokenInMint, tokenOutMint);

    const { poolInfo, poolRpcData: rpcData } = poolDetails;
    
    const { baseReserve, quoteReserve, status } = {
      baseReserve: rpcData.baseReserve,
      quoteReserve: rpcData.quoteReserve,
      status: rpcData.status.toNumber()
    };

    const isBaseTokenInput = tokenInMint.toString() === poolInfo.mintA.address;
    
    const [inputMintInfo, outputMintInfo] = isBaseTokenInput 
      ? [poolInfo.mintA, poolInfo.mintB] 
      : [poolInfo.mintB, poolInfo.mintA];

    const outputAmountData = this.raydium.liquidity.computeAmountOut({
      poolInfo: {
        ...poolInfo,
        baseReserve,
        quoteReserve,
        status,
        version: 4,
      },
      amountIn: new BN(amount.toString()),
      mintIn: inputMintInfo.address,
      mintOut: outputMintInfo.address,
      slippage: slippage / 100,
    });

    return BigInt(outputAmountData.amountOut.toString());
  }

  protected initializeConnection(): void {
    this.connection = new Connection(this.rpc, 'confirmed');
  }

  private async findLiquidityPool(tokenA: PublicKey, tokenB: PublicKey) {
    const raydium = await Raydium.load(this.raydiumLoadParams);

    const abDirectionFilter = this.createLiquidityPoolFilter(tokenA, tokenB);
    
    const baDirectionFilter = this.createLiquidityPoolFilter(tokenB, tokenA);

    const [abResults, baResults] = await Promise.all([
      this.connection.getProgramAccounts(DEVNET_PROGRAM_ID.AmmV4, abDirectionFilter),
      this.connection.getProgramAccounts(DEVNET_PROGRAM_ID.AmmV4, baDirectionFilter),
    ]);

    const uniquePools = new Map<string, typeof abResults[0]>();

    [...abResults, ...baResults].forEach(account => {
      uniquePools.set(account.pubkey.toBase58(), account);
    });

    const poolIds = Array.from(uniquePools.keys());

    if (poolIds.length === 0) {
      throw new Error(`No Raydium AMM pool found for token pair ${tokenA.toBase58()} and ${tokenB.toBase58()}`);
    }

    return await raydium.liquidity.getPoolInfoFromRpc({ poolId: poolIds[0] });
  }

  private createLiquidityPoolFilter(baseMint: PublicKey, quoteMint: PublicKey) {
    return {
      filters: [
        { dataSize: liquidityStateV4Layout.span },
        {
          memcmp: {
            offset: liquidityStateV4Layout.offsetOf('baseMint'),
            bytes: bs58.encode(Buffer.from(baseMint.toBytes())),
          },
        },
        {
          memcmp: {
            offset: liquidityStateV4Layout.offsetOf('quoteMint'),
            bytes: bs58.encode(Buffer.from(quoteMint.toBytes())),
          }
        }
      ],
      encoding: 'base64',
    };
  }
}