import { Raydium, RaydiumLoadParams, TxVersion } from "@raydium-io/raydium-sdk-v2";

import { IDEXAdapter } from "../interfaces";
import { Adapter } from "./adapter";

export abstract class RaydiumAdapter extends Adapter implements IDEXAdapter {
  static txVersion: TxVersion = TxVersion.V0;

  protected raydiumLoadParams: RaydiumLoadParams = {
    connection: this.connection,
    cluster: "devnet"
  }

  protected raydium!: Raydium;

  protected constructor() {
    super();
  }

  protected async init(): Promise<void> {
    if(!this.raydium) {
      this.raydium = await Raydium.load(this.raydiumLoadParams)
    }
    
    return;
  }
}