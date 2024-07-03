import { ethers } from "ethers";
import { MerkleTree } from "merkletreejs";

// Define the distribution data
// Each entry contains an Ethereum address and an amount in ether
const distributionData = [
  { account: "0x111423FA917A010A4f62c9B2742708744B4CbFc4", amount: ethers.utils.parseEther("1") },
  { account: "0xA7a0796E99c46D0643f9266722244a30564754D9", amount: ethers.utils.parseEther("2") },
  { account: "0x2B5eBa3377E57d333498653bcae8979A05b7c5e1", amount: ethers.utils.parseEther("3") }
];

// Create leaves for the Merkle Tree
// Each leaf is a keccak256 hash of the packed index, account, and amount
const leaves = distributionData.map((entry, index) => {
  return ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["uint256", "address", "uint256"],
      [index, entry.account, entry.amount]
    )
  );
});

// Create the Merkle Tree
// Uses keccak256 for hashing and sorts pairs to ensure deterministic output
const tree = new MerkleTree(leaves, ethers.utils.keccak256, { sortPairs: true });

// Get the Merkle Root
// This is the root hash of the Merkle Tree
const merkleRoot = tree.getHexRoot();
console.log("Merkle Root:", merkleRoot);

// Generate claim parameters for each entry in the distribution data
distributionData.forEach((entry, index) => {
  // Create the leaf for this entry
  const leaf = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["uint256", "address", "uint256"],
      [index, entry.account, entry.amount]
    )
  );
  
  // Get the Merkle proof for this leaf
  const proof = tree.getHexProof(leaf);

  // Log the claim parameters
  console.log(`\nClaim Parameters for index ${index}:`);
  console.log(`index: ${index}`);
  console.log(`account: "${entry.account}"`);
  console.log(`amount: "${entry.amount.toString()}"`);
  console.log(`merkleProof: ${JSON.stringify(proof)}`);

  // Verify the proof locally
  // This checks if the generated proof is valid for this leaf and the Merkle root
  const isValid = tree.verify(proof, leaf, merkleRoot);
  console.log(`Proof is valid: ${isValid}`);
});