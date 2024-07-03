// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import necessary OpenZeppelin contracts and interfaces
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PrivateYieldBearingERC20.sol";
import "./interface/IYieldBearingMerkleDistributor.sol";

// Main contract definition, inheriting from the interface and OpenZeppelin contracts
contract YieldBearingMerkleDistributor is
    IYieldBearingMerkleDistributor,
    Ownable,
    ReentrancyGuard
{
    // The ERC20 token being distributed
    PrivateYieldBearingERC20 private immutable _token;
    // The root of the Merkle tree
    bytes32 public immutable override merkleRoot;

    // to track claimed tokens
    mapping(uint256 => bool) private claimed;
    // Mapping to track accumulated yield for each address
    mapping(address => uint256) public accumulatedYield;



    // Start and end times for the distribution period
    uint256 public immutable override startTime;
    uint256 public immutable override endTime;

    // Total amount of unclaimed tokens
    uint256 public totalUnclaimed;
    // Total yield accumulated
    uint256 public totalYieldAccumulated;

    // Events for claiming tokens and accumulating yield
    event Claimed(
        uint256 index,
        address account,
        uint256 amount,
        uint256 yield
    );
    event YieldAccumulated(uint256 amount);

    // Constructor to initialize the contract
    constructor(bytes32 _merkleRoot, uint256 _totalSupply) Ownable(msg.sender) payable {
        require(msg.value == 1 ether, "Must send 1 ETH for yield");

        merkleRoot = _merkleRoot;
        // Deploy a new PrivateYieldBearingERC20 token contract
        _token = new PrivateYieldBearingERC20{value: 1 ether}(_totalSupply);
        totalUnclaimed = _totalSupply;
        startTime = block.timestamp;
        endTime = startTime + 30 days;
    }

    // Function to get the token address
    function token() public view override returns (IERC20) {
        return IERC20(address(_token));
    }

    // Check if a token has been claimed
    function isClaimed(uint256 index) public view returns (bool) {
        return claimed[index];
    }
    
    //Set a token as claimed
    function _setClaimed(uint256 index) private {
        claimed[index] = true;
    }

    // Update the accumulated yield
    function updateYield() public {
        uint256 newYield = _token.withdrawYield();
        if (newYield > 0 && totalUnclaimed > 0) {
            totalYieldAccumulated += newYield;
            emit YieldAccumulated(newYield);
        }
    }

    // View the current yield
    function currentYield() public view override returns (uint256) {
        return _token.viewYield();
    }

    // View the withdrawable yield
    function withdrawableYield() public view override returns (uint256) {
        return currentYield();
    }

    // Calculate claimable yield for a given amount
    function getClaimableYield(uint256 amount) public view returns (uint256) {
        if (totalUnclaimed == 0) return 0;
        return (totalYieldAccumulated * amount) / totalUnclaimed;
    }

    // Claim tokens and yield
    function claim(
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external override nonReentrant {
        require(!isClaimed(index), "MerkleDistributor: Yield already claimed.");

        // Verify the Merkle proof
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        require(
            MerkleProof.verify(merkleProof, merkleRoot, node),
            "MerkleDistributor: Invalid proof."
        );

        _setClaimed(index);

        updateYield(); // Update yield before calculating claimable amount
        uint256 yieldToTransfer = getClaimableYield(amount);
        totalUnclaimed -= amount;
        require(
            _token.transfer(account, (yieldToTransfer * 1000000)),
            "MerkleDistributor: Transfer failed."
        );

        // Transfer yield if any
        if (yieldToTransfer > 0) {
            (bool success, ) = account.call{value: yieldToTransfer}("");
            require(success, "MerkleDistributor: Yield transfer failed.");
        }

        emit Claimed(index, account, amount, yieldToTransfer);
    }

    // Withdraw accumulated yield (only owner)
    function withdrawYield() external override onlyOwner {
        updateYield();
        uint256 balance = address(this).balance;
        require(balance > 0, "No yield to withdraw");
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Yield transfer to owner failed");
    }

    // Function to allow contract to receive ETH
    receive() external payable {}
}
