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
  
  if (!info.freezeAuthority) {
    console.log('\nFreeze authority already revoked!');
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
  
  // Check if wallet is the freeze authority
  if (info.freezeAuthority.toBase58() !== wallet.publicKey.toBase58()) {
    console.log('ERROR: Wallet is not the freeze authority!');
    console.log('Freeze authority is:', info.freezeAuthority.toBase58());
    return;
  }
  
  console.log('\n🔥 Revoking freeze authority...');
  
  const sig = await setAuthority(
    conn,
    wallet,
    mint,
    wallet,
    AuthorityType.FreezeAccount,
    null // Set to null to revoke
  );
  
  console.log('✅ Freeze authority revoked!');
  console.log('Transaction:', sig);
  console.log('Explorer: https://explorer.solana.com/tx/' + sig);
  
  // Verify
  const newInfo = await getMint(conn, mint);
  console.log('\n=== Updated Token State ===');
  console.log('Freeze Authority:', newInfo.freezeAuthority?.toBase58() || 'REVOKED ✅');
}

main().catch(console.error);
