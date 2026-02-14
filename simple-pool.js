const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, transfer, createSyncNativeInstruction, NATIVE_MINT } = require("@solana/spl-token");
const fs = require("fs");

async function main() {
  const secretKey = JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  
  console.log("Wallet:", wallet.publicKey.toBase58());
  
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("SOL:", balance / 1e9);
  
  // Check if Raydium has a simple API endpoint
  const response = await fetch("https://api-v3.raydium.io/pools/info/mint?mint1=HRwiujVoE2W6T3nM81sXvri2nDziMRPif9rxY9YysnCA&poolType=standard&poolSortField=liquidity&sortType=desc&pageSize=10&page=1");
  const data = await response.json();
  console.log("Existing pools for CLAW:", JSON.stringify(data, null, 2));
}
main();
