import { Raydium } from '@raydium-io/raydium-sdk-v2'
import { getSolanaConnection } from '../../helpers/solana'

export * from './spaw'
export * from './types'

export let raydium: Raydium

export const initRaydiumSdk = async (params?: { loadToken?: boolean }) => {
  const solanaConnection = getSolanaConnection()
  raydium = await Raydium.load({
    connection: solanaConnection,
    cluster: 'mainnet',
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    // blockhashCommitment: 'finalized',
    // urlConfigs: {
    //   BASE_HOST: '<API_HOST>', // api url configs, currently api doesn't support devnet
    // },
  })

  // await readCachePoolData()

  return raydium
}
