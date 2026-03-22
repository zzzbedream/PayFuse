import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ═══════════════════════════════════════════════════════════
 *   PayFuse — Flujo E2E Completo (Prueba Local)
 * ═══════════════════════════════════════════════════════════
 *
 * Ejecuta el ciclo completo de un pago:
 *   1. Mint tokens pfUSD al Customer (via faucet)
 *   2. Registrar Merchant en el contrato (vía createPaymentOrder)
 *   3. Customer aprueba tokens → paga la orden
 *   4. Verifica evento OrderPaid
 *   5. Verifica saldos finales
 *
 * Uso:
 *   npx hardhat run scripts/e2eTest.ts --network localhost
 */
async function main() {
    const deployFile = path.join(
        __dirname, '..', 'deployments', `${network.name}.json`
    );

    if (!fs.existsSync(deployFile)) {
        console.error(`❌ No deployment file at ${deployFile}. Deploy first.`);
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(deployFile, 'utf-8'));
    const { PayFuseForwarder, PayFuseToken, POSPayment, PayFusePaymaster } = deployment.contracts;

    // Get Hardhat signers: [deployer, merchant, customer]
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const merchant = signers[1];
    const customer = signers[2];

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║      PayFuse — Flujo E2E Completo (Prueba Local)        ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`  Network   : ${network.name} (chain ${(await ethers.provider.getNetwork()).chainId})`);
    console.log(`  Deployer  : ${deployer.address}`);
    console.log(`  Merchant  : ${merchant.address}`);
    console.log(`  Customer  : ${customer.address}`);
    console.log(`  Forwarder : ${PayFuseForwarder}`);
    console.log(`  Token     : ${PayFuseToken}`);
    console.log(`  POS       : ${POSPayment}`);
    console.log(`  Paymaster : ${PayFusePaymaster}\n`);

    // Contract instances
    const token = await ethers.getContractAt('PayFuseToken', PayFuseToken);
    const pos = await ethers.getContractAt('POSPayment', POSPayment);
    const decimals = await token.decimals();
    const symbol = await token.symbol();

    console.log('─────────────────────────────────────────────────────────');
    console.log('  PASO 1: Mint tokens pfUSD al Customer (via faucet)');
    console.log('─────────────────────────────────────────────────────────\n');

    // Faucet gives to msg.sender (deployer), then transfer to customer
    const faucetAmount = ethers.parseUnits('1000', decimals);
    const faucetTx = await token.connect(deployer).faucet(faucetAmount);
    await faucetTx.wait();
    console.log(`  ✓ Deployer obtuvo 1000 ${symbol} del faucet`);

    const transferTx = await token.connect(deployer).transfer(customer.address, faucetAmount);
    await transferTx.wait();
    console.log(`  ✓ Transferidos 1000 ${symbol} al Customer`);

    const customerBalance = await token.balanceOf(customer.address);
    console.log(`  ✓ Balance del Customer: ${ethers.formatUnits(customerBalance, decimals)} ${symbol}\n`);

    console.log('─────────────────────────────────────────────────────────');
    console.log('  PASO 2: Crear Orden de Pago');
    console.log('─────────────────────────────────────────────────────────\n');

    const orderAmount = ethers.parseUnits('50', decimals); // $50 USD
    console.log(`  Creando orden por ${ethers.formatUnits(orderAmount, decimals)} ${symbol}…`);
    console.log(`  Merchant: ${merchant.address}`);
    console.log(`  Token   : ${PayFuseToken}`);

    const createTx = await pos.connect(deployer).createPaymentOrder(
        merchant.address,
        orderAmount,
        PayFuseToken
    );
    const createReceipt = await createTx.wait();

    // Extract orderId from OrderCreated event
    let orderId: string = '';
    for (const log of createReceipt.logs) {
        try {
            const parsed = pos.interface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed?.name === 'OrderCreated') {
                orderId = parsed.args.orderId;
                console.log(`\n  ✓ Orden creada exitosamente!`);
                console.log(`    Order ID  : ${orderId}`);
                console.log(`    Merchant  : ${parsed.args.merchant}`);
                console.log(`    Amount    : ${ethers.formatUnits(parsed.args.amount, decimals)} ${symbol}`);
                console.log(`    Expires   : ${new Date(Number(parsed.args.expiresAt) * 1000).toLocaleString()}`);
                console.log(`    Tx Hash   : ${createReceipt.hash}`);
                break;
            }
        } catch { /* skip non-matching logs */ }
    }

    if (!orderId) {
        console.error('❌ No se encontró el evento OrderCreated.');
        process.exit(1);
    }

    // Get order details
    const orderDetails = await pos.getOrderDetails(orderId);
    const statusNames = ['Pending', 'Paid', 'Cancelled', 'Expired'];
    console.log(`\n  📋 Detalle de la Orden:`);
    console.log(`     Status    : ${statusNames[Number(orderDetails.status)]}`);
    console.log(`     Amount    : ${ethers.formatUnits(orderDetails.amount, decimals)} ${symbol}`);

    console.log('\n─────────────────────────────────────────────────────────');
    console.log('  PASO 3: Customer Aprueba Tokens y Paga la Orden');
    console.log('─────────────────────────────────────────────────────────\n');

    // Approve
    console.log('  ① Aprobando tokens…');
    const approveTx = await token.connect(customer).approve(POSPayment, orderAmount);
    await approveTx.wait();
    console.log(`  ✓ Approve Tx: ${approveTx.hash}`);

    // Pay
    console.log('\n  ② Pagando la orden…');
    const payTx = await pos.connect(customer).payOrder(orderId);
    const payReceipt = await payTx.wait();
    console.log(`  ✓ Pay Tx    : ${payTx.hash}`);
    console.log(`  ✓ Block     : ${payReceipt.blockNumber}`);
    console.log(`  ✓ Gas Used  : ${payReceipt.gasUsed.toString()}`);

    console.log('\n─────────────────────────────────────────────────────────');
    console.log('  PASO 4: Verificar Evento OrderPaid');
    console.log('─────────────────────────────────────────────────────────\n');

    let orderPaidFound = false;
    for (const log of payReceipt.logs) {
        try {
            const parsed = pos.interface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed?.name === 'OrderPaid') {
                orderPaidFound = true;
                console.log('  🎉 ¡EVENTO OrderPaid DETECTADO!');
                console.log(`     Order ID : ${parsed.args.orderId}`);
                console.log(`     Payer    : ${parsed.args.payer}`);
                console.log(`     Merchant : ${parsed.args.merchant}`);
                console.log(`     Amount   : ${ethers.formatUnits(parsed.args.amount, decimals)} ${symbol}`);
                console.log(`     Fee      : ${ethers.formatUnits(parsed.args.fee, decimals)} ${symbol}`);
                break;
            }
        } catch { /* skip */ }
    }

    if (!orderPaidFound) {
        console.error('  ❌ No se encontró el evento OrderPaid.');
    }

    // Verify order status
    const orderAfterPay = await pos.getOrderDetails(orderId);
    console.log(`\n  📋 Estado de la Orden: ${statusNames[Number(orderAfterPay.status)]}`);

    console.log('\n─────────────────────────────────────────────────────────');
    console.log('  PASO 5: Verificar Saldos Finales');
    console.log('─────────────────────────────────────────────────────────\n');

    const merchantTokenBal = await token.balanceOf(merchant.address);
    const customerTokenBal = await token.balanceOf(customer.address);
    const feeCollectorBal = await token.balanceOf(deployer.address);

    console.log(`  Merchant  (${merchant.address}):`);
    console.log(`    ${symbol} Balance: ${ethers.formatUnits(merchantTokenBal, decimals)} ${symbol}`);

    console.log(`\n  Customer  (${customer.address}):`);
    console.log(`    ${symbol} Balance: ${ethers.formatUnits(customerTokenBal, decimals)} ${symbol}`);

    console.log(`\n  Fee Collector (${deployer.address}):`);
    console.log(`    ${symbol} Balance: ${ethers.formatUnits(feeCollectorBal, decimals)} ${symbol}`);

    // Summary
    const fee = orderAmount * BigInt(100) / BigInt(10000); // 1% fee
    const merchantReceived = orderAmount - fee;
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  📊 RESUMEN DEL FLUJO E2E');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Monto de la Orden     : ${ethers.formatUnits(orderAmount, decimals)} ${symbol}`);
    console.log(`  Fee Plataforma (1%)   : ${ethers.formatUnits(fee, decimals)} ${symbol}`);
    console.log(`  Merchant Recibe       : ${ethers.formatUnits(merchantReceived, decimals)} ${symbol}`);
    console.log(`  Estado Final Orden    : ${statusNames[Number(orderAfterPay.status)]}`);
    console.log(`  Evento OrderPaid      : ${orderPaidFound ? '✅ Emitido' : '❌ No encontrado'}`);
    console.log(`  Balance Merchant OK   : ${merchantTokenBal >= merchantReceived ? '✅' : '❌'}`);
    console.log('═══════════════════════════════════════════════════════');

    // Overall result
    const allPassed = orderPaidFound
        && Number(orderAfterPay.status) === 1
        && merchantTokenBal >= merchantReceived;

    if (allPassed) {
        console.log('\n  🟢 ¡TODOS LOS CHECKS PASARON! El MVP está funcional.\n');
    } else {
        console.log('\n  🔴 Algunos checks fallaron. Revisa los logs.\n');
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
