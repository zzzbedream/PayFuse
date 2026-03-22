/**
 * PayFuse - Database Initialization Script
 *
 * This script connects to MongoDB and creates the necessary
 * collections and indexes for the PayFuse application.
 *
 * Usage: node scripts/init-db.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: './apps/backend/.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/payfuse';

async function initDatabase() {
  console.log('🔌 Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();

    // Create collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    if (!collectionNames.includes('merchants')) {
      await db.createCollection('merchants');
      console.log('📦 Created "merchants" collection');
    }

    if (!collectionNames.includes('payments')) {
      await db.createCollection('payments');
      console.log('📦 Created "payments" collection');
    }

    // Create indexes for merchants
    await db.collection('merchants').createIndexes([
      { key: { email: 1 }, unique: true, name: 'idx_merchant_email' },
      { key: { walletAddress: 1 }, unique: true, name: 'idx_merchant_wallet' },
    ]);
    console.log('🔑 Created indexes for "merchants"');

    // Create indexes for payments
    await db.collection('payments').createIndexes([
      { key: { merchantId: 1 }, name: 'idx_payment_merchant' },
      { key: { status: 1 }, name: 'idx_payment_status' },
      { key: { txHash: 1 }, unique: true, sparse: true, name: 'idx_payment_txhash' },
      { key: { expiresAt: 1 }, name: 'idx_payment_expires' },
      { key: { createdAt: -1 }, name: 'idx_payment_created' },
    ]);
    console.log('🔑 Created indexes for "payments"');

    console.log('\n✅ Database initialization complete!');
    console.log(`   Database: ${db.databaseName}`);
    console.log(`   URI: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Connection closed');
  }
}

initDatabase();
