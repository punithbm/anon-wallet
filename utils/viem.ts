import { createPublicClient, http } from "viem";
import { baseGoerli } from "viem/chains";
export const publicClient = createPublicClient({
  chain: baseGoerli,
  transport: http(),
});
