import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Adapter',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    // rollupOptions: {
    //   external: [
    //     '@pump-fun/pump-swap-sdk',
    //     '@raydium-io/raydium-sdk-v2',
    //     '@solana/web3.js',
    //     '@solana/spl-token',
    //     'bn.js',
    //   ],
    //   output: {
    //     globals: {
    //       'bn.js': 'BN',
    //     },
    //   },
    // },
    sourcemap: false,
  },
  plugins: [dts()],
})
