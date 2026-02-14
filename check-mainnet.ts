import { Connection, Keypair } from "@solana/web3.js";
import * as fs from "fs";

async function checkMainnet() {
  const secretKey = JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
  
  console.log("🔑 Wallet:", wallet.publicKey.toBase58());
  
  // Check mainnet balance
  const mainnet = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const balance = await mainnet.getBalance(wallet.publicKey);
  console.log("💰 Mainnet Balance:", balance / 1e9, "SOL");
  
  // Estimate costs
  console.log("\n📊 Estimated costs for mainnet token launch:");
  console.log("   - Create mint account: ~0.00204 SOL");
  console.log("   - Create token account: ~0.00204 SOL");
  console.log("   - Mint transaction: ~0.000005 SOL");
  console.log("   - Buffer for safety: ~0.005 SOL");
  console.log("   ─────────────────────────────");
  console.log("   Total needed: ~0.01 SOL minimum");
  
  if (balance >= 0.01 * 1e9) {
    console.log("\n✅ Sufficient balance for mainnet launch!");
  } else {
    console.log("\n⚠️  Need more SOL! Please send at least", (0.01 - balance/1e9).toFixed(4), "SOL to:");
    console.log("   ", wallet.publicKey.toBase58());
  }
}

checkMainnet().catch(console.error);
