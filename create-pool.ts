import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { 
  Raydium,
  TxVersion,
  parseTokenAccountResp
} from "@raydium-io/raydium-sdk-v2";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";

const CLAW_MINT = "HRwiujVoE2W6T3nM81sXvri2nDziMRPif9rxY9YysnCA";
const SOL_MINT = "So11111111111111111111111111111111111111112"; // Wrapped SOL

async function createPool() {
  console.log("🌊 Creating CLAW/SOL Liquidity Pool...\n");

  // Load wallet
  const secretKey = JSON.parse(
    fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8")
  );
  const owner = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log("Wallet:", owner.publicKey.toBase58());

  // Connect to mainnet
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  
  // Check balances
  const solBalance = await connection.getBalance(owner.publicKey);
  console.log("SOL Balance:", solBalance / 1e9);

  // Initialize Raydium SDK
  const raydium = await Raydium.load({
    connection,
    owner,
    cluster: "mainnet",
    disableFeatureCheck: true,
    blockhashCommitment: "confirmed",
  });

  console.log("Raydium SDK loaded");

  // Get token accounts
  const tokenAccounts = await connection.getTokenAccountsByOwner(owner.publicKey, {
    programId: TOKEN_PROGRAM_ID,
  });
  
  console.log("Token accounts found:", tokenAccounts.value.length);

  // For CPMM pool creation
  const clawMint = new PublicKey(CLAW_MINT);
  const solMint = new PublicKey(SOL_MINT);

  // Pool parameters
  const baseAmount = 100_000_000 * 1e9; // 100M CLAW
  const quoteAmount = 1 * 1e9; // 1 SOL

  console.log("\nPool Parameters:");
  console.log("- Base (CLAW):", (baseAmount / 1e9).toLocaleString());
  console.log("- Quote (SOL):", quoteAmount / 1e9);
  console.log("- Initial Price:", (quoteAmount / baseAmount), "SOL per CLAW");

  try {
    // Create CPMM pool
    const { execute, extInfo } = await raydium.cpmm.createPool({
      programId: new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"), // CPMM program
      poolFeeAccount: new PublicKey("DNXgeM9EiiaAbaWvwjHj9fQQLAX5ZsfHyvmYUNRAdNC8"), // Fee account
      mintA: { address: clawMint, decimals: 9, programId: TOKEN_PROGRAM_ID },
      mintB: { address: solMint, decimals: 9, programId: TOKEN_PROGRAM_ID },
      mintAAmount: BigInt(baseAmount),
      mintBAmount: BigInt(quoteAmount),
      startTime: BigInt(0),
      feeConfig: { tradeFeeRate: 2500 }, // 0.25% fee
      associatedOnly: true,
      txVersion: TxVersion.V0,
    });

    console.log("\nExecuting pool creation...");
    const { txId } = await execute({ sendAndConfirm: true });
    
    console.log("\n🎉 POOL CREATED!");
    console.log("Transaction:", txId);
    console.log("Pool Info:", extInfo);
    
  } catch (error) {
    console.error("Error creating pool:", error);
  }
}

createPool().catch(console.error);
