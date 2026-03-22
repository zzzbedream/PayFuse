import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Usa la función faucet() del contrato PayFuseToken para distribuir
 * tokens de prueba (pfUSD) a las wallets de test.
 *
 * Uso:
 *   npx hardhat run scripts/mintTestTokens.ts --network fuseSpark
 *
 * Variables de entorno opcionales:
 *   MERCHANT_ADDRESS=0x...   (dirección del comerciante)
 *   CUSTOMER_ADDRESS=0x...   (dirección del cliente)
 *   FAUCET_AMOUNT=1000       (cantidad en unidades del token, default 1000)
 */
async function main() {
    const deployFile = path.join(
        __dirname,
        '..',
        'deployments',
        `${network.name}.json`
    );

    if (!fs.existsSync(deployFile)) {
        console.error(`❌ No deployment file at ${deployFile}.`);
        console.error(`   Deploy first: npm run deploy:spark`);
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(deployFile, 'utf-8'));
    const tokenAddr = deployment.contracts.PayFuseToken;

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║     PayFuse — Mint Test Tokens (Faucet)      ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`  Network: ${network.name}`);
    console.log(`  Token  : ${tokenAddr}\n`);

    const token = await ethers.getContractAt('PayFuseToken', tokenAddr);
    const decimals = await token.decimals();
    const symbol = await token.symbol();

    const faucetAmount = ethers.parseUnits(
        process.env.FAUCET_AMOUNT || '1000',
        decimals
    );

    // Collect addresses to fund
    const addresses: { label: string; address: string }[] = [];

    if (process.env.MERCHANT_ADDRESS) {
        addresses.push({ label: 'Merchant', address: process.env.MERCHANT_ADDRESS });
    }
    if (process.env.CUSTOMER_ADDRESS) {
        addresses.push({ label: 'Customer', address: process.env.CUSTOMER_ADDRESS });
    }

    // If no addresses provided, fund the deployer
    if (addresses.length === 0) {
        const [deployer] = await ethers.getSigners();
        addresses.push({ label: 'Deployer', address: deployer.address });
        console.log('  ⚠️  No MERCHANT_ADDRESS or CUSTOMER_ADDRESS set.');
        console.log(`  Defaulting to deployer: ${deployer.address}\n`);
    }

    for (const { label, address } of addresses) {
        console.log(`  Minting ${ethers.formatUnits(faucetAmount, decimals)} ${symbol} to ${label} (${address})…`);
        try {
            const tx = await token.faucet(faucetAmount);
            const receipt = await tx.wait();
            console.log(`  ✓ Tx: ${receipt.hash}`);

            // If faucet sends to msg.sender, we may need to transfer to the target
            // Check if the target != deployer
            const [deployer] = await ethers.getSigners();
            if (address.toLowerCase() !== deployer.address.toLowerCase()) {
                console.log(`  Transferring to ${address}…`);
                const txTransfer = await token.transfer(address, faucetAmount);
                const receiptTransfer = await txTransfer.wait();
                console.log(`  ✓ Transfer Tx: ${receiptTransfer.hash}`);
            }
        } catch (error: unknown) {
            console.error(`  ✗ Failed: ${(error as Error).message}`);
        }
        console.log('');
    }

    console.log('✅ Done!\n');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
