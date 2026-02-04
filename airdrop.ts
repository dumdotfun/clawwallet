import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

async function main() {
  const wallet = new PublicKey('9SJnsmMRFXatcucTh87TSa89Sp8EA3SuwoZQAkxd5CYT');
  
  // Try multiple RPC endpoints
  const endpoints = [
    'https://api.devnet.solana.com',
    'https://devnet.helius-rpc.com/?api-key=1d8740dc-e5f4-421c-b823-e1bad1889eff',
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Trying ${endpoint}...`);
      const connection = new Connection(endpoint, 'confirmed');
      const sig = await connection.requestAirdrop(wallet, 2 * LAMPORTS_PER_SOL);
      console.log('Airdrop requested! Signature:', sig);
      await connection.confirmTransaction(sig);
      console.log('Confirmed!');
      const balance = await connection.getBalance(wallet);
      console.log('New balance:', balance / LAMPORTS_PER_SOL, 'SOL');
      return;
    } catch (e: any) {
      console.log('Failed:', e.message);
    }
  }
}

main();
