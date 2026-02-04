import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as fs from 'fs';

const PROGRAM_ID = new PublicKey('AJtfLHhcqThpQrV4c3wrzwFZoHiMiXVCzeHHgYt6n74M');

// Anchor discriminators (first 8 bytes of sha256("global:method_name"))
const DISCRIMINATORS = {
  createWallet: Buffer.from([82, 172, 128, 18, 161, 207, 88, 63]), // create_wallet
  sendSol: Buffer.from([180, 84, 201, 116, 90, 222, 18, 218]), // send_sol
};

// Borsh schema for AgentWallet
class AgentWallet {
  agent_id: string;
  owner: Uint8Array;
  points: bigint;
  tx_count: bigint;
  created_at: bigint;
  bump: number;

  constructor(fields: any) {
    this.agent_id = fields.agent_id;
    this.owner = fields.owner;
    this.points = fields.points;
    this.tx_count = fields.tx_count;
    this.created_at = fields.created_at;
    this.bump = fields.bump;
  }
}

async function main() {
  // Load wallet
  const walletPath = `${process.env.HOME}/.config/solana/id.json`;
  const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
  
  console.log('='.repeat(60));
  console.log('ClawWallet Devnet Integration Test');
  console.log('='.repeat(60));
  console.log('\nWallet:', payer.publicKey.toBase58());
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  const balance = await connection.getBalance(payer.publicKey);
  console.log('Balance:', balance / LAMPORTS_PER_SOL, 'SOL');
  
  // Test 1: Create Agent Wallet
  console.log('\n--- Test 1: Create Agent Wallet ---');
  
  const agentId = 'test-agent-' + Date.now();
  const [agentWalletPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('wallet'), Buffer.from(agentId)],
    PROGRAM_ID
  );
  
  console.log('Agent ID:', agentId);
  console.log('PDA:', agentWalletPda.toBase58());
  
  // Create instruction data: discriminator + agent_id (as borsh string)
  const agentIdBytes = Buffer.from(agentId, 'utf-8');
  const instructionData = Buffer.concat([
    DISCRIMINATORS.createWallet,
    Buffer.from([agentIdBytes.length, 0, 0, 0]), // u32 length prefix for borsh string
    agentIdBytes
  ]);
  
  const createWalletIx = new TransactionInstruction({
    keys: [
      { pubkey: agentWalletPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });
  
  try {
    const tx = new Transaction().add(createWalletIx);
    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log('✅ Wallet created! Tx:', sig);
    console.log('   Explorer: https://explorer.solana.com/tx/' + sig + '?cluster=devnet');
    
    // Fetch and decode wallet data
    const accountInfo = await connection.getAccountInfo(agentWalletPda);
    if (accountInfo) {
      console.log('   Account data length:', accountInfo.data.length, 'bytes');
      // Skip 8-byte discriminator
      const data = accountInfo.data.slice(8);
      console.log('   Raw data (first 64 bytes):', data.slice(0, 64).toString('hex'));
    }
  } catch (e: any) {
    console.log('❌ Create wallet failed:', e.message);
    if (e.logs) {
      console.log('   Logs:', e.logs.slice(-5));
    }
  }
  
  // Test 2: Fund the agent wallet
  console.log('\n--- Test 2: Fund Agent Wallet ---');
  
  try {
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: agentWalletPda,
        lamports: 0.01 * LAMPORTS_PER_SOL,
      })
    );
    const fundSig = await sendAndConfirmTransaction(connection, fundTx, [payer]);
    console.log('✅ Funded 0.01 SOL! Tx:', fundSig);
    
    const walletBalance = await connection.getBalance(agentWalletPda);
    console.log('   Wallet balance:', walletBalance / LAMPORTS_PER_SOL, 'SOL');
  } catch (e: any) {
    console.log('❌ Funding failed:', e.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Integration Test Complete!');
  console.log('='.repeat(60));
  console.log('\nProgram ID:', PROGRAM_ID.toBase58());
  console.log('Agent Wallet:', agentWalletPda.toBase58());
}

main().catch(console.error);
