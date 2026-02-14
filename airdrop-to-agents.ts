import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
} from "@solana/spl-token";
import * as fs from "fs";

const CLAW_MINT = new PublicKey("zSUwhnJL87g4eyZphXvozVFVzRya9ZHk1kNSbXAdoBe");
const AIRDROP_AMOUNT = 1_000_000; // 1M tokens per agent
const DECIMALS = 9;

async function airdropToAgent(recipientAddress: string) {
  console.log(`\n🎁 Airdropping to ${recipientAddress}...`);

  // Load wallet
  const secretKey = JSON.parse(
    fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8")
  );
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));

  // Connect
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Get our token account
  const sourceAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    CLAW_MINT,
    payer.publicKey
  );

  // Get/create recipient token account
  const recipient = new PublicKey(recipientAddress);
  const destAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    CLAW_MINT,
    recipient
  );

  // Transfer
  const amount = BigInt(AIRDROP_AMOUNT) * BigInt(10 ** DECIMALS);
  const sig = await transfer(
    connection,
    payer,
    sourceAccount.address,
    destAccount.address,
    payer,
    amount
  );

  console.log(`✅ Airdropped ${AIRDROP_AMOUNT.toLocaleString()} $CLAW!`);
  console.log(`📝 Transaction: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  
  return sig;
}

// Process command line argument
const recipient = process.argv[2];
if (recipient) {
  airdropToAgent(recipient).catch(console.error);
} else {
  console.log("Usage: npx ts-node airdrop-to-agents.ts <WALLET_ADDRESS>");
}

export { airdropToAgent };
