import { ethers } from 'hardhat';

/**
 * Genera 3 wallets de prueba para el flujo E2E de PayFuse:
 *   - Relayer (paga gas en nombre de los usuarios)
 *   - Merchant (recibe pagos)
 *   - Customer (paga órdenes)
 *
 * Uso:
 *   npx hardhat run scripts/generateWallets.ts
 *
 * ⚠️  Guarda las claves privadas en un lugar seguro y
 *     NUNCA las subas al repositorio.
 */
async function main() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║     PayFuse — Generador de Wallets de Test   ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    const roles = ['RELAYER', 'MERCHANT', 'CUSTOMER'];

    for (const role of roles) {
        const wallet = ethers.Wallet.createRandom();
        console.log(`🔑 ${role}`);
        console.log(`   Address    : ${wallet.address}`);
        console.log(`   Private Key: ${wallet.privateKey}`);
        console.log('');
    }

    console.log('────────────────────────────────────────────────');
    console.log('📝 Próximos pasos:');
    console.log('   1. Copia las claves privadas al archivo .env correspondiente.');
    console.log('   2. Pide fondos en https://faucet.fusespark.io/ para cada dirección.');
    console.log('   3. Usa la wallet RELAYER como DEPLOYER_PRIVATE_KEY para desplegar contratos.');
    console.log('');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
