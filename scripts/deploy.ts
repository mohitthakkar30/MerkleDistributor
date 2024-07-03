import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Your distribution data
  const distributionData = [
    {
      account: "0x111423FA917A010A4f62c9B2742708744B4CbFc4",
      amount: ethers.utils.parseEther("1"),
    },
    {
      account: "0xA7a0796E99c46D0643f9266722244a30564754D9",
      amount: ethers.utils.parseEther("2"),
    },
    {
      account: "0x2B5eBa3377E57d333498653bcae8979A05b7c5e1",
      amount: ethers.utils.parseEther("3"),
    },
  ];

  // Create leaves for the Merkle Tree
  const leaves = distributionData.map((entry, index) => {
    return ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ["uint256", "address", "uint256"],
        [index, entry.account, entry.amount]
      )
    );
  });

  // Create the Merkle Tree
  const tree = new MerkleTree(leaves, ethers.utils.keccak256, { sortPairs: true });

  // Get the Merkle Root
  const merkleRoot = tree.getHexRoot();
  console.log("Merkle Root:", merkleRoot);

  // Set total supply to 21 million tokens
  const totalSupply = ethers.utils.parseEther("21000000");
  console.log("Total Supply:", ethers.utils.formatEther(totalSupply), "tokens");

  // Deploy YieldBearingMerkleDistributor
  //@ts-ignore
  const YieldBearingMerkleDistributor = await new ethers.ContractFactory(
    "YieldBearingMerkleDistributor"
  );
  
  const distributor = await YieldBearingMerkleDistributor.deploy(
    merkleRoot,
    totalSupply,
    { value: ethers.utils.parseEther("1") } // Send 1 ETH for yield
  );
  
  await distributor.deployed();

  console.log(
    "YieldBearingMerkleDistributor deployed to:",
    distributor.address
  );

  // Get the address of the PrivateYieldBearingERC20 token
  const tokenAddress = await distributor.token();
  console.log("PrivateYieldBearingERC20 token address:", tokenAddress);


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
