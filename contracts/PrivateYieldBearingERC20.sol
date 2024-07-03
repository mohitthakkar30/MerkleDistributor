// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IPrivateYieldBearingERC20} from "./interface/IPrivateYieldBearingERC20.sol";

/// @title PrivateYieldBearingERC20
/// @author Timelord
/// @dev Only generate native yield when the token is owned by the owner.
contract PrivateYieldBearingERC20 is
    IPrivateYieldBearingERC20,
    ERC20,
    Ownable2Step
{
    uint256 private constant TOTAL_YIELD = 1_000_000_000_000_000_000;

    uint256 public immutable start;
    uint256 public immutable end;
    uint256 public immutable lastUpdated;

    uint256 private yieldWithdrawn;

    constructor(
        uint256 totalSupply
    ) payable ERC20("Private Yield Bearing Token", "PYBT") Ownable(msg.sender) {
        if (msg.value != TOTAL_YIELD) revert();
        start = block.timestamp;
        end = block.timestamp + 30 days;
        lastUpdated = start;
        _mint(msg.sender, totalSupply);
    }

    function viewYield() public view override returns (uint256 yield) {
        uint256 duration = (block.timestamp < end ? block.timestamp : end) -
            start;
        yield = (TOTAL_YIELD * duration) / (end - start) - yieldWithdrawn;
    }

    function withdrawYield()
        external
        override
        onlyOwner
        returns (uint256 yield)
    {
        yield = viewYield();
        yieldWithdrawn += yield;
        (bool success, ) = msg.sender.call{value: yield}("");
        if (!success) revert();
    }
}