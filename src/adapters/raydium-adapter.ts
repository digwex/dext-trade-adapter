import { Raydium, RaydiumLoadParams, TxVersion } from "@raydium-io/raydium-sdk-v2";

import { IDEXAdapter } from "../interfaces";
import { Adapter } from "./adapter";

export abstract class RaydiumAdapter extends Adapter implements IDEXAdapter {
  // Static properties
  static readonly txVersion: TxVersion = TxVersion.V0;

  // Instance properties
  protected raydium!: Raydium;
  
  protected get raydiumLoadParams(): RaydiumLoadParams {
    return {
      connection: this.connection,
      cluster: "devnet"
    };
  }

  protected constructor() {
    super();
  }

  // Initialize Raydium SDK instance
  protected init = async (): Promise<void> => {
    if (!this.raydium) {
      this.raydium = await Raydium.load(this.raydiumLoadParams);
    }
  };
}