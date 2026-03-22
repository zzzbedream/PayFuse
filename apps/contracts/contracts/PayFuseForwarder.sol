// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/// @title PayFuseForwarder — Trusted ERC-2771 Forwarder for gasless meta-tx
/// @notice Deployed once on Fuse; its address is passed to all ERC2771Context
///         contracts (PayFuseToken, POSPayment) as the trustedForwarder.
///
/// Flow:
///   1. User signs an EIP-712 ForwardRequest off-chain (no gas needed)
///   2. Relayer (backend) submits the signed request to this contract
///   3. Forwarder verifies signature, then calls the target with the
///      original sender appended — target reads _msgSender() correctly
///   4. Relayer pays gas; user pays nothing
contract PayFuseForwarder is ERC2771Forwarder {
    constructor() ERC2771Forwarder("PayFuseForwarder") {}
}
