import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simula el pago de una orden desde la wallet del cliente.
 *
 * Pasos:
 *   1. Aprueba el token al contrato POSPayment
 *   2. Llama a payOrder(orderId)
 *
 * Uso:
 *   ORDER_ID=0x... CUSTOMER_PRIVATE_KEY=0x... npx hardhat run scripts/payOrder.ts --network fuseSpark
 *
 * Variables de entorno requeridas:
 *   ORDER_ID             — bytes32 del orderId
 *   CUSTOMER_PRIVATE_KEY — clave privada del cliente
 */
async function main() {
    const orderId = process.env.ORDER_ID;
    const customerKey = process.env.CUSTOMER_PRIVATE_KEY;

    if (!orderId || !customerKey) {
        console.error('❌ Se requieren ORDER_ID y CUSTOMER_PRIVATE_KEY como variables de entorno.');
        console.error('   Ejemplo:');
        console.error('   ORDER_ID=0xabc... CUSTOMER_PRIVATE_KEY=0xdef... npx hardhat run scripts/payOrder.ts --network fuseSpark');
        process.exit(1);
    }

    const deployFile = path.join(
        __dirname,
        '..',
        'deployments',
        `${network.name}.json`
    );

    if (!fs.existsSync(deployFile)) {
        console.error(`❌ No deployment file at ${deployFile}. Deploy first.`);
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(deployFile, 'utf-8'));
    const posAddr = deployment.contracts.POSPayment;
    const tokenAddr = deployment.contracts.PayFuseToken;

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║        PayFuse — Pagar Orden (E2E Test)      ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`  Network  : ${network.name}`);
    console.log(`  POS      : ${posAddr}`);
    console.log(`  Token    : ${tokenAddr}`);
    console.log(`  Order ID : ${orderId}\n`);

    // Connect the customer wallet
    const customer = new ethers.Wallet(customerKey, ethers.provider);
    console.log(`  Customer : ${customer.address}`);

    // Check native balance
    const nativeBalance = await ethers.provider.getBalance(customer.address);
    console.log(`  FUSE     : ${ethers.formatEther(nativeBalance)}`);

    // Get order details
    const pos = await ethers.getContractAt('POSPayment', posAddr, customer);
    const order = await pos.getOrderDetails(orderId);
    console.log(`  Merchant : ${order.merchant}`);
    console.log(`  Amount   : ${ethers.formatUnits(order.amount, 6)} pfUSD`);
    console.log(`  Status   : ${['Pending', 'Paid', 'Cancelled', 'Expired'][Number(order.status)]}`);
    console.log('');

    if (Number(order.status) !== 0) {
        console.error('❌ La orden no está en estado Pending. No se puede pagar.');
        process.exit(1);
    }

    // 1. Approve token spending
    const token = await ethers.getContractAt('PayFuseToken', tokenAddr, customer);
    const tokenBalance = await token.balanceOf(customer.address);
    const decimals = await token.decimals();
    console.log(`  Token Bal: ${ethers.formatUnits(tokenBalance, decimals)} pfUSD`);

    if (tokenBalance < order.amount) {
        console.error(`❌ Saldo insuficiente de pfUSD. Necesita ${ethers.formatUnits(order.amount, decimals)}.`);
        process.exit(1);
    }

    console.log('  ① Aprobando tokens al contrato POSPayment…');
    const approveTx = await token.approve(posAddr, order.amount);
    await approveTx.wait();
    console.log(`  ✓ Approve Tx: ${approveTx.hash}\n`);

    // 2. Pay the order
    console.log('  ② Pagando la orden…');
    const payTx = await pos.payOrder(orderId);
    const receipt = await payTx.wait();
    console.log(`  ✓ Pay Tx    : ${payTx.hash}`);
    console.log(`  ✓ Block     : ${receipt.blockNumber}`);
    console.log(`  ✓ Gas Used  : ${receipt.gasUsed.toString()}`);

    // Check if OrderPaid event was emitted
    const paidEvent = receipt.logs.find((log: ethers.Log) => {
        try {
            return pos.interface.parseLog({ topics: [...log.topics], data: log.data })?.name === 'OrderPaid';
        } catch {
            return false;
        }
    });

    if (paidEvent) {
        const parsed = pos.interface.parseLog({
            topics: [...paidEvent.topics],
            data: paidEvent.data,
        });
        console.log('\n  🎉 ¡Orden pagada exitosamente!');
        console.log(`     Payer   : ${parsed!.args.payer}`);
        console.log(`     Merchant: ${parsed!.args.merchant}`);
        console.log(`     Amount  : ${ethers.formatUnits(parsed!.args.amount, decimals)} pfUSD`);
        console.log(`     Fee     : ${ethers.formatUnits(parsed!.args.fee, decimals)} pfUSD`);
    } else {
        console.log('\n  ⚠️  No se encontró el evento OrderPaid en los logs.');
    }

    // Explorer link
    const explorerBase = network.name === 'fuseSpark'
        ? 'https://explorer.fusespark.io'
        : 'https://explorer.fuse.io';
    console.log(`\n  🔗 ${explorerBase}/tx/${payTx.hash}\n`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
