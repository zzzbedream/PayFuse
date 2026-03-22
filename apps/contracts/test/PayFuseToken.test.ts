import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { PayFuseToken, PayFuseForwarder } from '../typechain-types';

describe('PayFuseToken', function () {
  const NAME = 'PayFuse USD';
  const SYMBOL = 'pfUSD';
  const DECIMALS = 6;
  const INITIAL_SUPPLY = 1_000_000;

  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const Forwarder = await ethers.getContractFactory('PayFuseForwarder');
    const forwarder = await Forwarder.deploy();
    await forwarder.waitForDeployment();

    const Token = await ethers.getContractFactory('PayFuseToken');
    const token = await Token.deploy(
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY,
      await forwarder.getAddress()
    );
    await token.waitForDeployment();

    return { token, forwarder, owner, alice, bob };
  }

  describe('Deployment', function () {
    it('should set correct name, symbol, decimals', async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.name()).to.equal(NAME);
      expect(await token.symbol()).to.equal(SYMBOL);
      expect(await token.decimals()).to.equal(DECIMALS);
    });

    it('should mint initial supply to deployer', async function () {
      const { token, owner } = await loadFixture(deployFixture);
      const expected = BigInt(INITIAL_SUPPLY) * 10n ** BigInt(DECIMALS);
      expect(await token.balanceOf(owner.address)).to.equal(expected);
    });

    it('should set deployer as owner', async function () {
      const { token, owner } = await loadFixture(deployFixture);
      expect(await token.owner()).to.equal(owner.address);
    });

    it('should expose FAUCET_LIMIT constant', async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.FAUCET_LIMIT()).to.equal(10_000n);
    });
  });

  describe('Minting (owner)', function () {
    it('should allow owner to mint', async function () {
      const { token, alice } = await loadFixture(deployFixture);
      const amount = 500n * 10n ** BigInt(DECIMALS);
      await expect(token.mint(alice.address, amount))
        .to.emit(token, 'Transfer')
        .withArgs(ethers.ZeroAddress, alice.address, amount);
      expect(await token.balanceOf(alice.address)).to.equal(amount);
    });

    it('should revert mint from non-owner', async function () {
      const { token, alice } = await loadFixture(deployFixture);
      await expect(
        token.connect(alice).mint(alice.address, 100n)
      ).to.be.revertedWithCustomError(token, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Faucet', function () {
    it('should dispense tokens within limit', async function () {
      const { token, alice } = await loadFixture(deployFixture);
      const amount = 1000n * 10n ** BigInt(DECIMALS);
      await expect(token.connect(alice).faucet(amount))
        .to.emit(token, 'Faucet')
        .withArgs(alice.address, amount);
      expect(await token.balanceOf(alice.address)).to.equal(amount);
    });

    it('should revert when exceeding faucet limit', async function () {
      const { token, alice } = await loadFixture(deployFixture);
      const amount = 10_001n * 10n ** BigInt(DECIMALS);
      await expect(
        token.connect(alice).faucet(amount)
      ).to.be.revertedWith('PayFuseToken: faucet limit exceeded');
    });

    it('should allow max exactly FAUCET_LIMIT', async function () {
      const { token, alice } = await loadFixture(deployFixture);
      const amount = 10_000n * 10n ** BigInt(DECIMALS);
      await expect(token.connect(alice).faucet(amount)).to.not.be.reverted;
    });
  });

  describe('ERC20 Permit (ERC-2612)', function () {
    it('should support permit for gasless approvals', async function () {
      const { token, owner, alice } = await loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      const amount = 100n * 10n ** BigInt(DECIMALS);
      const nonce = await token.nonces(owner.address);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const domain = {
        name: NAME,
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: tokenAddress,
      };

      const types = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      };

      const value = {
        owner: owner.address,
        spender: alice.address,
        value: amount,
        nonce,
        deadline,
      };

      const sig = await owner.signTypedData(domain, types, value);
      const { v, r, s } = ethers.Signature.from(sig);

      await token.permit(owner.address, alice.address, amount, deadline, v, r, s);
      expect(await token.allowance(owner.address, alice.address)).to.equal(amount);
    });
  });

  describe('Transfers', function () {
    it('should transfer between accounts', async function () {
      const { token, owner, alice } = await loadFixture(deployFixture);
      const amount = 50n * 10n ** BigInt(DECIMALS);
      await token.transfer(alice.address, amount);
      expect(await token.balanceOf(alice.address)).to.equal(amount);
    });

    it('should fail transfer exceeding balance', async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      await expect(
        token.connect(alice).transfer(bob.address, 1n)
      ).to.be.revertedWithCustomError(token, 'ERC20InsufficientBalance');
    });
  });
});
