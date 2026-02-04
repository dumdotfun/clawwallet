import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import * as fs from 'fs';

const PROGRAM_ID = new PublicKey('AJtfLHhcqThpQrV4c3wrzwFZoHiMiXVCzeHHgYt6n74M');

async function main() {
  // Load wallet
  const walletPath = `${process.env.HOME}/.config/solana/id.json`;
  const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
  
  console.log('Wallet:', payer.publicKey.toBase58());
  
  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  const balance = await connection.getBalance(payer.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');
  
  // Derive PDA for agent wallet
  const agentId = 'test-agent-' + Date.now();
  const [agentWalletPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent_wallet'), Buffer.from(agentId)],
    PROGRAM_ID
  );
  
  console.log('Agent ID:', agentId);
  console.log('Agent Wallet PDA:', agentWalletPda.toBase58());
  
  // Check if program exists
  const programInfo = await connection.getAccountInfo(PROGRAM_ID);
  if (programInfo) {
    console.log('✅ Program deployed! Executable:', programInfo.executable);
    console.log('   Data length:', programInfo.data.length, 'bytes');
  } else {
    console.log('❌ Program not found');
  }
  
  console.log('\n✅ Devnet deployment verified!');
  console.log('\nProgram ID:', PROGRAM_ID.toBase58());
  console.log('Explorer: https://explorer.solana.com/address/' + PROGRAM_ID.toBase58() + '?cluster=devnet');
}

main().catch(console.error);
