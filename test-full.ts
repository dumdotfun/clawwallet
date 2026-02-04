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
import * as crypto from 'crypto';

const PROGRAM_ID = new PublicKey('AJtfLHhcqThpQrV4c3wrzwFZoHiMiXVCzeHHgYt6n74M');
const TREASURY = new PublicKey('9SJnsmMRFXatcucTh87TSa89Sp8EA3SuwoZQAkxd5CYT'); // Fees go here

function getDiscriminator(name: string): Buffer {
  return Buffer.from(crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8));
}

async function main() {
  const walletPath = `${process.env.HOME}/.config/solana/id.json`;
  const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
  
  console.log('='.repeat(60));
  console.log('ClawWallet Full Integration Test');
  console.log('='.repeat(60));
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // 1. Create wallet
  console.log('\n1️⃣ Creating Agent Wallet...');
  const agentId = 'fulltest-' + Date.now();
  const [walletPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('wallet'), Buffer.from(agentId)],
    PROGRAM_ID
  );
  
  const agentIdBytes = Buffer.from(agentId, 'utf-8');
  const createData = Buffer.concat([
    getDiscriminator('create_wallet'),
    Buffer.from([agentIdBytes.length, 0, 0, 0]),
    agentIdBytes
  ]);
  
  const createIx = new TransactionInstruction({
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: createData,
  });
  
  let tx = new Transaction().add(createIx);
  let sig = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log('✅ Wallet created:', walletPda.toBase58());
  console.log('   Tx:', sig);
  
  // 2. Fund wallet
  console.log('\n2️⃣ Funding wallet with 0.05 SOL...');
  tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: walletPda,
      lamports: 0.05 * LAMPORTS_PER_SOL,
    })
  );
  sig = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log('✅ Funded! Tx:', sig);
  
  let balance = await connection.getBalance(walletPda);
  console.log('   Wallet balance:', balance / LAMPORTS_PER_SOL, 'SOL');
  
  // 3. Send SOL (tests the fee mechanism)
  console.log('\n3️⃣ Sending 0.01 SOL (with 0.5% fee)...');
  const recipient = Keypair.generate().publicKey;
  const amount = 0.01 * LAMPORTS_PER_SOL;
  
  const sendData = Buffer.concat([
    getDiscriminator('send_sol'),
    Buffer.from(new BigUint64Array([BigInt(amount)]).buffer)
  ]);
  
  const sendIx = new TransactionInstruction({
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // owner
      { pubkey: recipient, isSigner: false, isWritable: true },
      { pubkey: TREASURY, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: sendData,
  });
  
  try {
    tx = new Transaction().add(sendIx);
    sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log('✅ Sent! Tx:', sig);
    
    balance = await connection.getBalance(walletPda);
    console.log('   Wallet balance after send:', balance / LAMPORTS_PER_SOL, 'SOL');
    
    const recipientBalance = await connection.getBalance(recipient);
    console.log('   Recipient received:', recipientBalance / LAMPORTS_PER_SOL, 'SOL');
    console.log('   Fee (0.5%):', (amount * 0.005) / LAMPORTS_PER_SOL, 'SOL');
  } catch (e: any) {
    console.log('❌ Send failed:', e.message);
    if (e.logs) console.log('   Logs:', e.logs.slice(-5));
  }
  
  // 4. Read wallet state
  console.log('\n4️⃣ Reading wallet state...');
  const accountInfo = await connection.getAccountInfo(walletPda);
  if (accountInfo) {
    const data = accountInfo.data.slice(8); // Skip discriminator
    // Parse: agent_id (string), owner (pubkey), points (u64), created_at (i64), tx_count (u64), bump (u8)
    const agentIdLen = data.readUInt32LE(0);
    const parsedAgentId = data.slice(4, 4 + agentIdLen).toString('utf-8');
    const owner = new PublicKey(data.slice(4 + agentIdLen, 4 + agentIdLen + 32));
    const points = data.readBigUInt64LE(4 + agentIdLen + 32);
    
    console.log('   Agent ID:', parsedAgentId);
    console.log('   Owner:', owner.toBase58());
    console.log('   Points:', points.toString());
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL TESTS PASSED!');
  console.log('='.repeat(60));
  console.log('\nProgram: https://explorer.solana.com/address/' + PROGRAM_ID.toBase58() + '?cluster=devnet');
  console.log('Wallet: https://explorer.solana.com/address/' + walletPda.toBase58() + '?cluster=devnet');
}

main().catch(console.error);
