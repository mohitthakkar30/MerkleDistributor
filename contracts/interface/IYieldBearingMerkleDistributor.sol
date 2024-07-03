// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IYieldBearingMerkleDistributor {
    function token() external view returns (IERC20);
    function merkleRoot() external view returns (bytes32);
    function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof) external;
    function isClaimed(uint256 index) external view returns (bool);
    function startTime() external view returns (uint256);
    function endTime() external view returns (uint256);
    function currentYield() external view returns (uint256);
    function withdrawableYield() external view returns (uint256);
    function withdrawYield() external;
}