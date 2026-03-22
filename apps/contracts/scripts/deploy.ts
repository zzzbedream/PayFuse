import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

interface DeploymentResult {
  network: string;
  chainId: number;
  deployer: string;
  contracts: Record<string, string>;
  timestamp: string;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║        PayFuse — Contract Deployment         ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Network : ${network.name} (chain ${chainId})`);
  console.log(`  Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance : ${ethers.formatEther(balance)} FUSE\n`);

  // ── 1. Deploy Forwarder (ERC-2771 gasless meta-tx relay) ──
  console.log('① Deploying PayFuseForwarder…');
  const Forwarder = await ethers.getContractFactory('PayFuseForwarder');
  const forwarder = await Forwarder.deploy();
  await forwarder.waitForDeployment();
  const forwarderAddr = await forwarder.getAddress();
  console.log(`   ✓ PayFuseForwarder : ${forwarderAddr}\n`);

  // ── 2. Deploy Token (ERC-20 + ERC-2771 + Permit) ──
  console.log('② Deploying PayFuseToken (pfUSD)…');
  const Token = await ethers.getContractFactory('PayFuseToken');
  const token = await Token.deploy(
    'PayFuse USD',   // name
    'pfUSD',         // symbol
    6,               // decimals (stablecoin standard)
    1_000_000,       // initial supply: 1M pfUSD
    forwarderAddr    // trusted forwarder
  );
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`   ✓ PayFuseToken     : ${tokenAddr}\n`);

  // ── 3. Deploy POSPayment (order lifecycle + multi-token) ──
  const feeBps = 100; // 1%
  console.log(`③ Deploying POSPayment (fee: ${feeBps / 100}%)…`);
  const POS = await ethers.getContractFactory('POSPayment');
  const pos = await POS.deploy(feeBps, deployer.address, forwarderAddr);
  await pos.waitForDeployment();
  const posAddr = await pos.getAddress();
  console.log(`   ✓ POSPayment       : ${posAddr}\n`);

  // ── 4. Register pfUSD as supported token ──
  console.log('④ Registering pfUSD as supported payment token…');
  const tx = await pos.addSupportedToken(tokenAddr);
  await tx.wait();
  console.log('   ✓ pfUSD whitelisted\n');

  // ── 5. Deploy Paymaster (ERC-4337 gas sponsoring) ──
  const entryPointAddress =
    process.env.ENTRYPOINT_ADDRESS ||
    '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'; // canonical v0.6

  console.log('⑤ Deploying PayFusePaymaster (ERC-4337)…');
  const Paymaster = await ethers.getContractFactory('PayFusePaymaster');
  const paymaster = await Paymaster.deploy(entryPointAddress, deployer.address);
  await paymaster.waitForDeployment();
  const paymasterAddr = await paymaster.getAddress();
  console.log(`   ✓ PayFusePaymaster : ${paymasterAddr}\n`);

  // ── Summary ───────────────────────────────────────
  const result: DeploymentResult = {
    network: network.name,
    chainId: Number(chainId),
    deployer: deployer.address,
    contracts: {
      PayFuseForwarder: forwarderAddr,
      PayFuseToken: tokenAddr,
      POSPayment: posAddr,
      PayFusePaymaster: paymasterAddr,
    },
    timestamp: new Date().toISOString(),
  };

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║           Deployment Complete                ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║ Forwarder : ${forwarderAddr}  ║`);
  console.log(`║ Token     : ${tokenAddr}  ║`);
  console.log(`║ POS       : ${posAddr}  ║`);
  console.log(`║ Paymaster : ${paymasterAddr}  ║`);
  console.log('╚══════════════════════════════════════════════╝');

  // Save deployment addresses to JSON for other apps to consume
  const outDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`\n📄 Addresses saved to ${outFile}`);

  console.log('\n🔧 Update your backend .env with:');
  console.log(`   TOKEN_CONTRACT_ADDRESS=${tokenAddr}`);
  console.log(`   PAYMENT_CONTRACT_ADDRESS=${posAddr}`);
  console.log(`   FORWARDER_ADDRESS=${forwarderAddr}`);
  console.log(`   PAYMASTER_ADDRESS=${paymasterAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
