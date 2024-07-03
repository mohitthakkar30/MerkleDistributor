// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPrivateYieldBearingERC20 is IERC20 {
    function start() external view returns (uint256 time);

    function end() external view returns (uint256 time);

    function viewYield() external view returns (uint256 yield);

    function withdrawYield() external returns (uint256 yield);
}
