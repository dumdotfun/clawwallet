import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "fs";

async function launchClawTokenMainnet() {
  console.log("🚀 Launching $CLAW Token on MAINNET...\n");

  // Load wallet
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
  
  console.log("📋 Wallet Address:", payer.publicKey.toBase58());

  // Connect to MAINNET
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  
  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log("💰 Mainnet Balance:", balance / 1e9, "SOL\n");

  if (balance < 0.01 * 1e9) {
    console.log("❌ Insufficient balance for mainnet deployment!");
    return;
  }

  // Token parameters
  const decimals = 9;
  const totalSupply = 1_000_000_000; // 1 billion $CLAW

  console.log("🪙 Creating $CLAW Token Mint on MAINNET...");
  
  // Create the token mint
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey, // mint authority
    payer.publicKey, // freeze authority
    decimals
  );

  console.log("✅ Token Mint Created on MAINNET!");
  console.log("📍 Mint Address:", mint.toBase58());
  console.log(`🔗 Explorer: https://explorer.solana.com/address/${mint.toBase58()}\n`);

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

  console.log("\n🎉 $CLAW TOKEN LAUNCHED ON MAINNET!");
  console.log("=====================================");
  console.log("Token Name: CLAW");
  console.log("Symbol: $CLAW");
  console.log("Decimals:", decimals);
  console.log("Total Supply:", totalSupply.toLocaleString());
  console.log("Mint Address:", mint.toBase58());
  console.log("Treasury:", tokenAccount.address.toBase58());
  console.log(`Explorer: https://explorer.solana.com/address/${mint.toBase58()}`);
  
  // Save token info
  const tokenInfo = {
    name: "CLAW",
    symbol: "$CLAW",
    decimals,
    totalSupply,
    mint: mint.toBase58(),
    treasury: tokenAccount.address.toBase58(),
    launchedAt: new Date().toISOString(),
    network: "mainnet-beta"
  };
  
  fs.writeFileSync("token-info-mainnet.json", JSON.stringify(tokenInfo, null, 2));
  console.log("\n📄 Token info saved to token-info-mainnet.json");
}

launchClawTokenMainnet().catch(console.error);
