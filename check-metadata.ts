import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fetchMetadataFromSeeds, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";

const CLAW_MINT = "HRwiujVoE2W6T3nM81sXvri2nDziMRPif9rxY9YysnCA";

async function checkMetadata() {
  const umi = createUmi("https://api.mainnet-beta.solana.com").use(mplTokenMetadata());
  
  try {
    const metadata = await fetchMetadataFromSeeds(umi, { mint: publicKey(CLAW_MINT) });
    console.log("On-chain Metadata:");
    console.log("- Name:", metadata.name);
    console.log("- Symbol:", metadata.symbol);
    console.log("- URI:", metadata.uri);
  } catch (e: any) {
    console.log("Error fetching metadata:", e.message);
  }
}

checkMetadata();
