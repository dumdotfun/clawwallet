import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { 
  createMetadataAccountV3,
  mplTokenMetadata 
} from "@metaplex-foundation/mpl-token-metadata";
import { 
  keypairIdentity,
  publicKey,
  createSignerFromKeypair,
} from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";

const CLAW_MINT = "HRwiujVoE2W6T3nM81sXvri2nDziMRPif9rxY9YysnCA";
const LOGO_URL = "https://raw.githubusercontent.com/dumdotfun/clawwallet/main/claw-logo.svg";

async function addMetadata() {
  console.log("📝 Adding metadata to $CLAW token...\n");

  // Load wallet
  const secretKey = JSON.parse(
    fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8")
  );
  const web3Keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
  
  // Setup Umi
  const umi = createUmi("https://api.mainnet-beta.solana.com")
    .use(mplTokenMetadata());
  
  const umiKeypair = fromWeb3JsKeypair(web3Keypair);
  umi.use(keypairIdentity(umiKeypair));

  const signer = createSignerFromKeypair(umi, umiKeypair);

  console.log("Wallet:", web3Keypair.publicKey.toBase58());
  console.log("Mint:", CLAW_MINT);

  const mint = publicKey(CLAW_MINT);

  try {
    // Create metadata
    console.log("\nCreating metadata account...");
    
    const builder = createMetadataAccountV3(umi, {
      mint,
      mintAuthority: signer,
      payer: signer,
      updateAuthority: umiKeypair.publicKey,
      data: {
        name: "CLAW",
        symbol: "CLAW",
        uri: LOGO_URL,
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null,
      },
      isMutable: true,
      collectionDetails: null,
    });

    const tx = await builder.sendAndConfirm(umi);

    console.log("\n✅ Metadata added successfully!");
    console.log("Signature:", Buffer.from(tx.signature).toString('base64'));
    console.log("\nToken now has:");
    console.log("- Name: CLAW");
    console.log("- Symbol: CLAW");  
    console.log("- Logo:", LOGO_URL);
    console.log("\nView on Solscan: https://solscan.io/token/" + CLAW_MINT);
    
  } catch (error: any) {
    console.error("Error:", error.message || error);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
  }
}

addMetadata().catch(console.error);
