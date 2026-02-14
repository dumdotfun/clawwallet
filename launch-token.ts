import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";

async function launchClawToken() {
  console.log("🚀 Launching $CLAW Token...\n");

  // Load wallet
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
  
  console.log("📋 Wallet Address:", payer.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  
  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log("💰 Balance:", balance / 1e9, "SOL\n");

  if (balance < 0.05 * 1e9) {
    console.log("⚠️  Low balance! Requesting airdrop...");
    const airdropSig = await connection.requestAirdrop(payer.publicKey, 1e9);
    await connection.confirmTransaction(airdropSig);
    console.log("✅ Airdrop received!\n");
  }

  // Token parameters
  const decimals = 9;
  const totalSupply = 1_000_000_000; // 1 billion $CLAW

  console.log("🪙 Creating $CLAW Token Mint...");
  
  // Create the token mint
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey, // mint authority
    payer.publicKey, // freeze authority
    decimals
  );

  console.log("✅ Token Mint Created!");
  console.log("📍 Mint Address:", mint.toBase58());
  console.log(`🔗 Explorer: https://explorer.solana.com/address/${mint.toBase58()}?cluster=devnet\n`);

  // Create token account for payer
  console.log("📦 Creating Token Account...");
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );
  console.log("✅ Token Account:", tokenAccount.address.toBase58());

  // Mint initial supply
  console.log(`\n💎 Minting ${totalSupply.toLocaleString()} $CLAW tokens...`);
  await mintTo(
    connection,
    payer,
    mint,
    tokenAccount.address,
    payer,
    BigInt(totalSupply) * BigInt(10 ** decimals)
  );

  console.log("\n🎉 $CLAW TOKEN LAUNCHED SUCCESSFULLY!");
  console.log("=====================================");
  console.log("Token Name: CLAW");
  console.log("Symbol: $CLAW");
  console.log("Decimals:", decimals);
  console.log("Total Supply:", totalSupply.toLocaleString());
  console.log("Mint Address:", mint.toBase58());
  console.log("Treasury:", tokenAccount.address.toBase58());
  console.log(`Explorer: https://explorer.solana.com/address/${mint.toBase58()}?cluster=devnet`);
  
  // Save token info
  const tokenInfo = {
    name: "CLAW",
    symbol: "$CLAW",
    decimals,
    totalSupply,
    mint: mint.toBase58(),
    treasury: tokenAccount.address.toBase58(),
    launchedAt: new Date().toISOString(),
    network: "devnet"
  };
  
  fs.writeFileSync("token-info.json", JSON.stringify(tokenInfo, null, 2));
  console.log("\n📄 Token info saved to token-info.json");
}

launchClawToken().catch(console.error);
