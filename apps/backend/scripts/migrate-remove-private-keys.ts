/**
 * Migration: Remove walletPrivateKey from all merchants
 *
 * This migration is part of the transition to a non-custodial model.
 * After running this migration:
 * - Merchants will need to reconnect their wallets
 * - The walletPrivateKey field will be removed from all documents
 *
 * IMPORTANT: This is a one-way migration. Backup your database first!
 *
 * Usage:
 *   npx ts-node scripts/migrate-remove-private-keys.ts
 *
 * Or with environment:
 *   MONGODB_URI=mongodb://... npx ts-node scripts/migrate-remove-private-keys.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/payfuse';

async function migrate(): Promise<void> {
  console.log('🔄 Starting migration: Remove walletPrivateKey');
  console.log(`   Database: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }

  const merchants = db.collection('merchants');

  // Count merchants with private keys
  const countWithKeys = await merchants.countDocuments({
    walletPrivateKey: { $exists: true, $ne: null },
  });

  console.log(`\n📊 Found ${countWithKeys} merchants with walletPrivateKey`);

  if (countWithKeys === 0) {
    console.log('✅ No migration needed - no private keys found');
    await mongoose.disconnect();
    return;
  }

  // Confirm before proceeding
  console.log('\n⚠️  This will permanently remove all walletPrivateKey fields.');
  console.log('   Merchants will need to reconnect their wallets after this migration.');
  console.log('\n   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Remove walletPrivateKey from all documents
  const result = await merchants.updateMany(
    { walletPrivateKey: { $exists: true } },
    {
      $unset: { walletPrivateKey: '' },
      $set: {
        walletConnectedAt: null, // Mark as needing reconnection
      },
    }
  );

  console.log(`✅ Migration complete:`);
  console.log(`   - Modified: ${result.modifiedCount} documents`);
  console.log(`   - Matched: ${result.matchedCount} documents`);

  // Add index for walletConnectedAt if not exists
  const indexes = await merchants.indexes();
  const hasWalletIndex = indexes.some(
    (idx: { key?: { walletConnectedAt?: number } }) => idx.key?.walletConnectedAt
  );

  if (!hasWalletIndex) {
    await merchants.createIndex({ walletConnectedAt: 1 });
    console.log('✅ Created index on walletConnectedAt');
  }

  await mongoose.disconnect();
  console.log('\n🎉 Migration completed successfully!');
  console.log('   Next steps:');
  console.log('   1. Deploy the updated backend');
  console.log('   2. Notify merchants to reconnect their wallets');
}

migrate().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
