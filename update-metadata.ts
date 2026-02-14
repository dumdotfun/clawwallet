import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { updateMetadataAccountV2, mplTokenMetadata, fetchMetadataFromSeeds } from "@metaplex-foundation/mpl-token-metadata";
import { keypairIdentity, publicKey, createSignerFromKeypair } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";

const CLAW_MINT = "HRwiujVoE2W6T3nM81sXvri2nDziMRPif9rxY9YysnCA";
const METADATA_URI = "https://raw.githubusercontent.com/dumdotfun/clawwallet/main/claw-metadata.json";

async function updateMetadata() {
  console.log("📝 Updating metadata URI to JSON file...\n");

  const secretKey = JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8"));
  const web3Keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
  
  const umi = createUmi("https://api.mainnet-beta.solana.com").use(mplTokenMetadata());
  const umiKeypair = fromWeb3JsKeypair(web3Keypair);
  umi.use(keypairIdentity(umiKeypair));
  
  const signer = createSignerFromKeypair(umi, umiKeypair);

  const mint = publicKey(CLAW_MINT);
  
  // Fetch current metadata
  const currentMetadata = await fetchMetadataFromSeeds(umi, { mint });
  console.log("Current URI:", currentMetadata.uri);

  // Update metadata
  const tx = await updateMetadataAccountV2(umi, {
    metadata: currentMetadata.publicKey,
    updateAuthority: signer,
    data: {
      name: "CLAW",
      symbol: "CLAW",
      uri: METADATA_URI,
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    },
    isMutable: true,
    primarySaleHappened: false,
  }).sendAndConfirm(umi);

  console.log("\n✅ Metadata updated!");
  console.log("New URI:", METADATA_URI);
}

updateMetadata().catch(console.error);
