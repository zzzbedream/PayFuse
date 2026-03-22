import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Verifica el saldo nativo (FUSE/SPARK) de una dirección,
 * y opcionalmente el saldo de pfUSD si los contratos están desplegados.
 *
 * Uso:
 *   npx hardhat run scripts/balance.ts --network fuseSpark
 *
 * Para verificar una dirección específica, establece la variable de entorno:
 *   CHECK_ADDRESS=0x... npx hardhat run scripts/balance.ts --network fuseSpark
 */
async function main() {
    const targetAddress =
        process.env.CHECK_ADDRESS ||
        (await ethers.getSigners()).then((s) => s[0].address);

    const address =
        typeof targetAddress === 'string' ? targetAddress : await targetAddress;

    console.log(`\n🔍 Checking balances on ${network.name}…`);
    console.log(`   Address: ${address}\n`);

    // ── Native balance ──
    const nativeBalance = await ethers.provider.getBalance(address);
    console.log(`   💰 Native (FUSE): ${ethers.formatEther(nativeBalance)} FUSE`);

    // ── Token balance (if deployed) ──
    const deployFile = path.join(
        __dirname,
        '..',
        'deployments',
        `${network.name}.json`
    );

    if (fs.existsSync(deployFile)) {
        const deployment = JSON.parse(fs.readFileSync(deployFile, 'utf-8'));
        const tokenAddr = deployment.contracts?.PayFuseToken;

        if (tokenAddr) {
            const token = await ethers.getContractAt('PayFuseToken', tokenAddr);
            const decimals = await token.decimals();
            const tokenBalance = await token.balanceOf(address);
            const symbol = await token.symbol();
            console.log(
                `   🪙 ${symbol}     : ${ethers.formatUnits(tokenBalance, decimals)} ${symbol}`
            );
        }
    } else {
        console.log('   ℹ️  No deployment file found — skipping token balance.');
    }

    console.log('');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
