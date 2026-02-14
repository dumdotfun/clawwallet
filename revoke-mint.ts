import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getMint, setAuthority, AuthorityType } from '@solana/spl-token';
import * as fs from 'fs';

async function main() {
  const conn = new Connection('https://api.mainnet-beta.solana.com');
  const mint = new PublicKey('HRwiujVoE2W6T3nM81sXvri2nDziMRPif9rxY9YysnCA');
  
  // Check current state
  const info = await getMint(conn, mint);
  console.log('=== Current Token State ===');
  console.log('Mint Authority:', info.mintAuthority?.toBase58() || 'REVOKED ✅');
  console.log('Freeze Authority:', info.freezeAuthority?.toBase58() || 'REVOKED ✅');
  console.log('Supply:', (Number(info.supply) / 1e9).toLocaleString(), 'CLAW');
  
  if (!info.mintAuthority) {
    console.log('\nMint authority already revoked!');
    return;
  }
  
  // Load wallet
  const walletPath = process.env.HOME + '/.config/solana/id.json';
  if (!fs.existsSync(walletPath)) {
    console.log('\nWallet not found at:', walletPath);
    return;
  }
  
  const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log('\nWallet:', wallet.publicKey.toBase58());
  
  // Check if wallet is the mint authority
  if (info.mintAuthority.toBase58() !== wallet.publicKey.toBase58()) {
    console.log('ERROR: Wallet is not the mint authority!');
    return;
  }
  
  console.log('\n⚠️  WARNING: This is PERMANENT! No more $CLAW can ever be minted!');
  console.log('🔥 Revoking mint authority...');
  
  const sig = await setAuthority(
    conn,
    wallet,
    mint,
    wallet,
    AuthorityType.MintTokens,
    null // Set to null to revoke
  );
  
  console.log('✅ Mint authority revoked!');
  console.log('Transaction:', sig);
  console.log('Explorer: https://explorer.solana.com/tx/' + sig);
  
  // Verify
  const newInfo = await getMint(conn, mint);
  console.log('\n=== Final Token State ===');
  console.log('Mint Authority:', newInfo.mintAuthority?.toBase58() || 'REVOKED ✅');
  console.log('Freeze Authority:', newInfo.freezeAuthority?.toBase58() || 'REVOKED ✅');
  console.log('Supply:', (Number(newInfo.supply) / 1e9).toLocaleString(), 'CLAW (FIXED FOREVER)');
}

main().catch(console.error);
