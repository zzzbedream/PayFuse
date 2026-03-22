import { run, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Verify all deployed contracts on FuseScan / FuseSparkScan.
 *
 * Usage:
 *   npm run verify:spark   # Fuse Spark testnet
 *   npm run verify:fuse    # Fuse mainnet
 *
 * Requires FUSE_EXPLORER_API_KEY in .env
 */
async function main() {
  const deployFile = path.join(
    __dirname,
    '..',
    'deployments',
    `${network.name}.json`
  );

  if (!fs.existsSync(deployFile)) {
    console.error(`❌ No deployment file found at ${deployFile}`);
    console.error(`   Run deploy first: npm run deploy:${network.name === 'fuseSpark' ? 'spark' : 'fuse'}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deployFile, 'utf-8'));
  const contracts = deployment.contracts;
  const deployer = deployment.deployer;

  console.log(`\n🔍 Verifying contracts on ${network.name}…\n`);

  // 1. Forwarder — no constructor args
  await verifyContract('PayFuseForwarder', contracts.PayFuseForwarder, []);

  // 2. Token — constructor(name, symbol, decimals, initialSupply, trustedForwarder)
  await verifyContract('PayFuseToken', contracts.PayFuseToken, [
    'PayFuse USD',
    'pfUSD',
    6,
    1_000_000,
    contracts.PayFuseForwarder,
  ]);

  // 3. POSPayment — constructor(feeBps, feeCollector, trustedForwarder)
  await verifyContract('POSPayment', contracts.POSPayment, [
    100,
    deployer,
    contracts.PayFuseForwarder,
  ]);

  // 4. Paymaster — constructor(entryPoint, verifyingSigner)
  const entryPoint =
    process.env.ENTRYPOINT_ADDRESS ||
    '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
  await verifyContract('PayFusePaymaster', contracts.PayFusePaymaster, [
    entryPoint,
    deployer,
  ]);

  console.log('\n✅ All verifications submitted.');
}

async function verifyContract(
  name: string,
  address: string,
  constructorArguments: unknown[]
) {
  try {
    console.log(`  Verifying ${name} at ${address}…`);
    await run('verify:verify', {
      address,
      constructorArguments,
    });
    console.log(`  ✓ ${name} verified\n`);
  } catch (error: unknown) {
    const msg = (error as Error).message || '';
    if (msg.includes('Already Verified') || msg.includes('already verified')) {
      console.log(`  ⚠ ${name} already verified\n`);
    } else {
      console.error(`  ✗ ${name} verification failed: ${msg}\n`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
