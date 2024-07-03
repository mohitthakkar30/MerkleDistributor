//@ts-nocheck
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");

describe("YieldBearingMerkleDistributor", function() {
  let distributor, token, owner, addr1, addr2, addr3;
  let merkleTree, merkleRoot;

  const TOTAL_SUPPLY = ethers.utils.parseEther("21000000");
  const ONE_ETH = ethers.utils.parseEther("1");

  beforeEach(async function() {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Create distribution data
    const distributionData = [
      { account: addr1.address, amount: ethers.utils.parseEther("1") },
      { account: addr2.address, amount: ethers.utils.parseEther("1.5") },
      { account: addr3.address, amount: ethers.utils.parseEther("1.2") }
    ];

    // Create Merkle tree
    const leaves = distributionData.map((entry, index) =>
      ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "uint256"],
          [index, entry.account, entry.amount]
        )
      )
    );
    merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    merkleRoot = merkleTree.getHexRoot();

    // Deploy YieldBearingMerkleDistributor
    const YieldBearingMerkleDistributor = await ethers.getContractFactory("YieldBearingMerkleDistributor");
    distributor = await YieldBearingMerkleDistributor.deploy(merkleRoot, TOTAL_SUPPLY, { value: ONE_ETH });
    await distributor.deployed();

    // Get PrivateYieldBearingERC20 instance
    const tokenAddress = await distributor.token();
    token = await ethers.getContractAt("PrivateYieldBearingERC20", tokenAddress);
  });

  describe("Deployment", function() {
    it("Should set the right owner", async function() {
      expect(await distributor.owner()).to.equal(owner.address);
    });

    it("Should set the correct merkle root", async function() {
      expect(await distributor.merkleRoot()).to.equal(merkleRoot);
    });

    it("Should set the correct total unclaimed amount", async function() {
      expect(await distributor.totalUnclaimed()).to.equal(TOTAL_SUPPLY);
    });

    it("Should set the correct start and end times", async function() {
      const startTime = await distributor.startTime();
      const endTime = await distributor.endTime();
      expect(endTime).to.equal(startTime.add(30 * 24 * 60 * 60)); // 30 days
    });
  });

  describe("Claiming", function() {
    it("Should allow claiming tokens with valid proof", async function() {
      const index = 0;
      const amount = ethers.utils.parseEther("1");
      const leaf = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "uint256"],
          [index, addr1.address, amount]
        )
      );
      const proof = merkleTree.getHexProof(leaf);

      await expect(distributor.connect(addr1).claim(index, addr1.address, amount, proof))
        .to.emit(distributor, "Claimed")
        .withArgs(index, addr1.address, amount, 0); 

      expect(await token.balanceOf(addr1.address)).to.equal(amount);
    });

    it("Should not allow claiming with invalid proof", async function() {
      const index = 0;
      const amount = ethers.utils.parseEther("1");
      const invalidProof = [ethers.utils.randomBytes(32)];

      await expect(distributor.connect(addr1).claim(index, addr1.address, amount, invalidProof))
        .to.be.revertedWith("MerkleDistributor: Invalid proof.");
    });

    it("Should not allow double claiming", async function() {
      const index = 0;
      const amount = ethers.utils.parseEther("1");
      const leaf = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "uint256"],
          [index, addr1.address, amount]
        )
      );
      const proof = merkleTree.getHexProof(leaf);

      await distributor.connect(addr1).claim(index, addr1.address, amount, proof);

      await expect(distributor.connect(addr1).claim(index, addr1.address, amount, proof))
        .to.be.revertedWith("MerkleDistributor: Yield already claimed.");
    });
  });

  describe("Yield", function() {
    it("Should accumulate yield", async function() {
      // Simulate passage of time
      await ethers.provider.send("evm_increaseTime", [15 * 24 * 60 * 60]); // 15 days
      await ethers.provider.send("evm_mine");

      await distributor.updateYield();
      expect(await distributor.totalYieldAccumulated()).to.be.gt(0);
    });

    it("Should distribute yield when claiming", async function() {
      // Accumulate some yield
      await ethers.provider.send("evm_increaseTime", [15 * 24 * 60 * 60]); // 15 days
      await ethers.provider.send("evm_mine");
      await distributor.updateYield();

      const index = 0;
      const amount = ethers.utils.parseEther("1");
      const leaf = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address", "uint256"],
          [index, addr1.address, amount]
        )
      );
      const proof = merkleTree.getHexProof(leaf);

      const balanceBefore = await ethers.provider.getBalance(addr1.address);
      await distributor.connect(addr1).claim(index, addr1.address, amount, proof);
      const balanceAfter = await ethers.provider.getBalance(addr1.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should allow owner to withdraw remaining yield", async function() {
      // Accumulate some yield
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]); // 30 days
      await ethers.provider.send("evm_mine");

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      await distributor.withdrawYield();
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  describe("View functions", function() {
    it("Should return correct token address", async function() {
      expect(await distributor.token()).to.equal(token.address);
    });

    it("Should return correct claimable yield", async function() {
      const amount = ethers.utils.parseEther("1");
      const claimableYield = await distributor.getClaimableYield(amount);
      expect(claimableYield).to.equal(0); // Initially 0

      // Accumulate some yield
      await ethers.provider.send("evm_increaseTime", [15 * 24 * 60 * 60]); // 15 days
      await ethers.provider.send("evm_mine");
      await distributor.updateYield();

      const newClaimableYield = await distributor.getClaimableYield(amount);
      expect(newClaimableYield).to.be.gt(0);
    });
  });
});