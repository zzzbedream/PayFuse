import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('POSPayment', function () {
  const DECIMALS = 6;
  const FEE_BPS = 100; // 1%
  const INITIAL_SUPPLY = 1_000_000;
  const ORDER_AMOUNT = 100n * 10n ** BigInt(DECIMALS); // 100 pfUSD

  async function deployFixture() {
    const [owner, merchant, customer, feeCollector, stranger] =
      await ethers.getSigners();

    // Deploy forwarder
    const Forwarder = await ethers.getContractFactory('PayFuseForwarder');
    const forwarder = await Forwarder.deploy();
    await forwarder.waitForDeployment();
    const forwarderAddr = await forwarder.getAddress();

    // Deploy token
    const Token = await ethers.getContractFactory('PayFuseToken');
    const token = await Token.deploy(
      'PayFuse USD',
      'pfUSD',
      DECIMALS,
      INITIAL_SUPPLY,
      forwarderAddr
    );
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();

    // Deploy POS
    const POS = await ethers.getContractFactory('POSPayment');
    const pos = await POS.deploy(FEE_BPS, feeCollector.address, forwarderAddr);
    await pos.waitForDeployment();

    // Whitelist the token
    await pos.addSupportedToken(tokenAddr);

    // Fund customer with tokens
    await token.transfer(customer.address, 10_000n * 10n ** BigInt(DECIMALS));

    return { pos, token, forwarder, owner, merchant, customer, feeCollector, stranger };
  }

  // ─── Helpers ───────────────────────────────────────

  async function createOrder(
    fixture: Awaited<ReturnType<typeof deployFixture>>
  ) {
    const { pos, token, merchant } = fixture;
    const tokenAddr = await token.getAddress();
    const tx = await pos.createPaymentOrder(
      merchant.address,
      ORDER_AMOUNT,
      tokenAddr
    );
    const receipt = await tx.wait();
    const event = receipt?.logs.find((log) => {
      try {
        return pos.interface.parseLog({ topics: [...log.topics], data: log.data })?.name === 'OrderCreated';
      } catch { return false; }
    });
    const parsed = pos.interface.parseLog({
      topics: [...event!.topics],
      data: event!.data,
    });
    return parsed!.args.orderId as string;
  }

  // ─── Deployment ────────────────────────────────────

  describe('Deployment', function () {
    it('should set correct fee, feeCollector, orderTTL', async function () {
      const { pos, feeCollector } = await loadFixture(deployFixture);
      expect(await pos.feeBps()).to.equal(FEE_BPS);
      expect(await pos.feeCollector()).to.equal(feeCollector.address);
      expect(await pos.orderTTL()).to.equal(30 * 60); // 30 minutes
    });

    it('should revert if fee > 500 bps', async function () {
      const { forwarder, feeCollector } = await loadFixture(deployFixture);
      const POS = await ethers.getContractFactory('POSPayment');
      await expect(
        POS.deploy(501, feeCollector.address, await forwarder.getAddress())
      ).to.be.revertedWithCustomError(POS, 'FeeTooHigh');
    });

    it('should revert if feeCollector is zero address', async function () {
      const { forwarder } = await loadFixture(deployFixture);
      const POS = await ethers.getContractFactory('POSPayment');
      await expect(
        POS.deploy(100, ethers.ZeroAddress, await forwarder.getAddress())
      ).to.be.revertedWithCustomError(POS, 'InvalidAddress');
    });
  });

  // ─── Token Management ─────────────────────────────

  describe('Token Management', function () {
    it('should allow owner to add supported token', async function () {
      const { pos, owner } = await loadFixture(deployFixture);
      const fake = ethers.Wallet.createRandom().address;
      await expect(pos.addSupportedToken(fake))
        .to.emit(pos, 'TokenAdded')
        .withArgs(fake);
      expect(await pos.supportedTokens(fake)).to.be.true;
    });

    it('should allow owner to remove supported token', async function () {
      const { pos, token } = await loadFixture(deployFixture);
      const tokenAddr = await token.getAddress();
      await expect(pos.removeSupportedToken(tokenAddr))
        .to.emit(pos, 'TokenRemoved')
        .withArgs(tokenAddr);
      expect(await pos.supportedTokens(tokenAddr)).to.be.false;
    });

    it('should revert addSupportedToken with zero address', async function () {
      const { pos } = await loadFixture(deployFixture);
      await expect(
        pos.addSupportedToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(pos, 'InvalidAddress');
    });

    it('should revert if non-owner tries to add token', async function () {
      const { pos, stranger } = await loadFixture(deployFixture);
      await expect(
        pos.connect(stranger).addSupportedToken(ethers.Wallet.createRandom().address)
      ).to.be.revertedWithCustomError(pos, 'OwnableUnauthorizedAccount');
    });
  });

  // ─── createPaymentOrder ────────────────────────────

  describe('createPaymentOrder', function () {
    it('should create an order and emit OrderCreated', async function () {
      const { pos, token, merchant } = await loadFixture(deployFixture);
      const tokenAddr = await token.getAddress();

      await expect(
        pos.createPaymentOrder(merchant.address, ORDER_AMOUNT, tokenAddr)
      ).to.emit(pos, 'OrderCreated');
    });

    it('should generate unique order ids', async function () {
      const fixture = await loadFixture(deployFixture);
      const id1 = await createOrder(fixture);
      const id2 = await createOrder(fixture);
      expect(id1).to.not.equal(id2);
    });

    it('should store correct order details', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, token, merchant } = fixture;
      const orderId = await createOrder(fixture);

      const order = await pos.getOrderDetails(orderId);
      expect(order.merchant).to.equal(merchant.address);
      expect(order.amount).to.equal(ORDER_AMOUNT);
      expect(order.currency).to.equal(await token.getAddress());
      expect(order.status).to.equal(0); // Pending
      expect(order.payer).to.equal(ethers.ZeroAddress);
      expect(order.fee).to.equal(0);
    });

    it('should add orderId to merchant orders list', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, merchant } = fixture;
      const orderId = await createOrder(fixture);

      const ids = await pos.getMerchantOrders(merchant.address);
      expect(ids).to.include(orderId);
      expect(await pos.getMerchantOrderCount(merchant.address)).to.equal(1);
    });

    it('should revert with zero merchant address', async function () {
      const { pos, token } = await loadFixture(deployFixture);
      await expect(
        pos.createPaymentOrder(ethers.ZeroAddress, ORDER_AMOUNT, await token.getAddress())
      ).to.be.revertedWithCustomError(pos, 'InvalidAddress');
    });

    it('should revert with zero amount', async function () {
      const { pos, token, merchant } = await loadFixture(deployFixture);
      await expect(
        pos.createPaymentOrder(merchant.address, 0, await token.getAddress())
      ).to.be.revertedWithCustomError(pos, 'InvalidAmount');
    });

    it('should revert with unsupported token', async function () {
      const { pos, merchant } = await loadFixture(deployFixture);
      const fake = ethers.Wallet.createRandom().address;
      await expect(
        pos.createPaymentOrder(merchant.address, ORDER_AMOUNT, fake)
      ).to.be.revertedWithCustomError(pos, 'TokenNotSupported');
    });
  });

  // ─── payOrder ──────────────────────────────────────

  describe('payOrder', function () {
    it('should pay order, transfer tokens (minus fee), emit OrderPaid', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, token, merchant, customer, feeCollector } = fixture;
      const orderId = await createOrder(fixture);
      const posAddr = await pos.getAddress();

      // Approve POS to spend tokens
      await token.connect(customer).approve(posAddr, ORDER_AMOUNT);

      const merchantBefore = await token.balanceOf(merchant.address);
      const feeBefore = await token.balanceOf(feeCollector.address);

      await expect(pos.connect(customer).payOrder(orderId))
        .to.emit(pos, 'OrderPaid');

      const expectedFee = (ORDER_AMOUNT * BigInt(FEE_BPS)) / 10_000n;
      const expectedMerchant = ORDER_AMOUNT - expectedFee;

      expect(await token.balanceOf(merchant.address)).to.equal(
        merchantBefore + expectedMerchant
      );
      expect(await token.balanceOf(feeCollector.address)).to.equal(
        feeBefore + expectedFee
      );
    });

    it('should mark order as Paid with correct payer and fee', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, token, customer } = fixture;
      const orderId = await createOrder(fixture);
      const posAddr = await pos.getAddress();

      await token.connect(customer).approve(posAddr, ORDER_AMOUNT);
      await pos.connect(customer).payOrder(orderId);

      const order = await pos.getOrderDetails(orderId);
      expect(order.status).to.equal(1); // Paid
      expect(order.payer).to.equal(customer.address);
      expect(order.fee).to.equal((ORDER_AMOUNT * BigInt(FEE_BPS)) / 10_000n);
    });

    it('should revert when paying non-existent order', async function () {
      const { pos, customer } = await loadFixture(deployFixture);
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes('nonexistent'));
      await expect(
        pos.connect(customer).payOrder(fakeId)
      ).to.be.revertedWithCustomError(pos, 'OrderNotFound');
    });

    it('should revert when paying already-paid order', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, token, customer } = fixture;
      const orderId = await createOrder(fixture);
      const posAddr = await pos.getAddress();

      await token.connect(customer).approve(posAddr, ORDER_AMOUNT * 2n);
      await pos.connect(customer).payOrder(orderId);

      await expect(
        pos.connect(customer).payOrder(orderId)
      ).to.be.revertedWithCustomError(pos, 'OrderNotPending');
    });

    it('should revert when paying cancelled order', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, token, merchant, customer } = fixture;
      const orderId = await createOrder(fixture);
      const posAddr = await pos.getAddress();

      await pos.connect(merchant).cancelOrder(orderId);
      await token.connect(customer).approve(posAddr, ORDER_AMOUNT);

      await expect(
        pos.connect(customer).payOrder(orderId)
      ).to.be.revertedWithCustomError(pos, 'OrderNotPending');
    });

    it('should auto-expire and revert after TTL', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, token, customer } = fixture;
      const orderId = await createOrder(fixture);
      const posAddr = await pos.getAddress();

      await token.connect(customer).approve(posAddr, ORDER_AMOUNT);

      // Advance time past 30-minute TTL
      await time.increase(31 * 60);

      await expect(
        pos.connect(customer).payOrder(orderId)
      ).to.be.revertedWithCustomError(pos, 'OrderExpiredError');
    });

    it('should revert when customer has insufficient allowance', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, customer } = fixture;
      const orderId = await createOrder(fixture);

      // No approval
      await expect(
        pos.connect(customer).payOrder(orderId)
      ).to.be.reverted; // SafeERC20 will revert
    });
  });

  // ─── cancelOrder ───────────────────────────────────

  describe('cancelOrder', function () {
    it('should cancel and emit OrderCancelled', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, merchant } = fixture;
      const orderId = await createOrder(fixture);

      await expect(pos.connect(merchant).cancelOrder(orderId))
        .to.emit(pos, 'OrderCancelled')
        .withArgs(orderId, merchant.address);

      const order = await pos.getOrderDetails(orderId);
      expect(order.status).to.equal(2); // Cancelled
    });

    it('should revert if non-merchant cancels', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, stranger } = fixture;
      const orderId = await createOrder(fixture);

      await expect(
        pos.connect(stranger).cancelOrder(orderId)
      ).to.be.revertedWithCustomError(pos, 'NotMerchant');
    });

    it('should revert cancelling already-paid order', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, token, merchant, customer } = fixture;
      const orderId = await createOrder(fixture);
      const posAddr = await pos.getAddress();

      await token.connect(customer).approve(posAddr, ORDER_AMOUNT);
      await pos.connect(customer).payOrder(orderId);

      await expect(
        pos.connect(merchant).cancelOrder(orderId)
      ).to.be.revertedWithCustomError(pos, 'OrderNotPending');
    });

    it('should revert cancelling non-existent order', async function () {
      const { pos, merchant } = await loadFixture(deployFixture);
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes('fake'));
      await expect(
        pos.connect(merchant).cancelOrder(fakeId)
      ).to.be.revertedWithCustomError(pos, 'OrderNotFound');
    });
  });

  // ─── getOrderDetails ──────────────────────────────

  describe('getOrderDetails', function () {
    it('should return full details for existing order', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, token, merchant } = fixture;
      const orderId = await createOrder(fixture);

      const order = await pos.getOrderDetails(orderId);
      expect(order.id).to.equal(orderId);
      expect(order.merchant).to.equal(merchant.address);
      expect(order.amount).to.equal(ORDER_AMOUNT);
      expect(order.currency).to.equal(await token.getAddress());
    });

    it('should revert for non-existent order', async function () {
      const { pos } = await loadFixture(deployFixture);
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes('nope'));
      await expect(pos.getOrderDetails(fakeId)).to.be.revertedWithCustomError(
        pos,
        'OrderNotFound'
      );
    });
  });

  // ─── Admin Functions ───────────────────────────────

  describe('Admin', function () {
    it('should update fee and emit FeeUpdated', async function () {
      const { pos } = await loadFixture(deployFixture);
      await expect(pos.setFee(200))
        .to.emit(pos, 'FeeUpdated')
        .withArgs(FEE_BPS, 200);
      expect(await pos.feeBps()).to.equal(200);
    });

    it('should revert setFee > 500', async function () {
      const { pos } = await loadFixture(deployFixture);
      await expect(pos.setFee(501)).to.be.revertedWithCustomError(
        pos,
        'FeeTooHigh'
      );
    });

    it('should update feeCollector', async function () {
      const { pos, stranger } = await loadFixture(deployFixture);
      await expect(pos.setFeeCollector(stranger.address))
        .to.emit(pos, 'FeeCollectorUpdated');
      expect(await pos.feeCollector()).to.equal(stranger.address);
    });

    it('should revert setFeeCollector with zero address', async function () {
      const { pos } = await loadFixture(deployFixture);
      await expect(
        pos.setFeeCollector(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(pos, 'InvalidAddress');
    });

    it('should update orderTTL', async function () {
      const { pos } = await loadFixture(deployFixture);
      await expect(pos.setOrderTTL(3600))
        .to.emit(pos, 'OrderTTLUpdated')
        .withArgs(30 * 60, 3600);
      expect(await pos.orderTTL()).to.equal(3600);
    });

    it('should pause and unpause', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, token, merchant } = fixture;
      const tokenAddr = await token.getAddress();

      await pos.pause();
      await expect(
        pos.createPaymentOrder(merchant.address, ORDER_AMOUNT, tokenAddr)
      ).to.be.revertedWithCustomError(pos, 'EnforcedPause');

      await pos.unpause();
      await expect(
        pos.createPaymentOrder(merchant.address, ORDER_AMOUNT, tokenAddr)
      ).to.emit(pos, 'OrderCreated');
    });

    it('should restrict admin functions to owner', async function () {
      const { pos, stranger } = await loadFixture(deployFixture);
      await expect(
        pos.connect(stranger).setFee(200)
      ).to.be.revertedWithCustomError(pos, 'OwnableUnauthorizedAccount');
      await expect(
        pos.connect(stranger).pause()
      ).to.be.revertedWithCustomError(pos, 'OwnableUnauthorizedAccount');
    });
  });

  // ─── Zero Fee Edge Case ────────────────────────────

  describe('Zero Fee', function () {
    it('should transfer full amount to merchant when fee is 0', async function () {
      const fixture = await loadFixture(deployFixture);
      const { pos, token, merchant, customer } = fixture;

      await pos.setFee(0);
      const orderId = await createOrder(fixture);
      const posAddr = await pos.getAddress();

      await token.connect(customer).approve(posAddr, ORDER_AMOUNT);
      const merchantBefore = await token.balanceOf(merchant.address);

      await pos.connect(customer).payOrder(orderId);

      expect(await token.balanceOf(merchant.address)).to.equal(
        merchantBefore + ORDER_AMOUNT
      );
    });
  });
});
