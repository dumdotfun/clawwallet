import { Keypair } from "@solana/web3.js";
import * as fs from "fs";

// @ts-ignore
const bs58 = require("bs58");

const secretKey = JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8"));
const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

console.log("=== WALLET EXPORT ===");
console.log("Address:", wallet.publicKey.toBase58());
console.log("Private Key (Base58):", bs58.encode(wallet.secretKey));
console.log("\nImport into Phantom: Settings > Manage Accounts > Add/Import > Import Private Key");
