import { Connection, Keypair, Transaction, TransactionInstruction, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import * as fs from "fs";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

async function commitMemo(message: string) {
  const walletPath = "/root/clawd/skills/kamino-yield/config/wallet.json";
  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")))
  );
  
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`Wallet: ${keypair.publicKey.toBase58()}`);
  console.log(`Balance: ${balance / 1e9} SOL`);
  
  if (balance < 10000) {
    console.log("Insufficient balance for memo transaction");
    return;
  }
  
  const memoIx = new TransactionInstruction({
    keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(message, "utf-8"),
  });
  
  const tx = new Transaction().add(memoIx);
  
  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
    console.log(`Memo committed: ${sig}`);
    console.log(`Solscan: https://solscan.io/tx/${sig}`);
    return sig;
  } catch (e: any) {
    console.error(`Failed: ${e.message}`);
  }
}

const memo = JSON.stringify({
  agent: "Prometheus",
  action: "hackathon_entry",
  timestamp: new Date().toISOString(),
  decision: "Entering Colosseum Agent Hackathon. Strategy: demonstrate real autonomous DeFi execution with verifiable on-chain history. Project: Prometheus Vault.",
  wallet: "7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz",
  txCount: 83,
  daysActive: 10
});

commitMemo(memo);
