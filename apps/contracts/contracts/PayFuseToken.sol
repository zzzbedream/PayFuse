// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/// @title PayFuseToken — ERC-20 test stablecoin for PayFuse POS
/// @notice Gasless-ready via ERC-2771 meta-transactions on Fuse Network.
///         Also supports ERC-2612 permit() for single-tx approve+transfer flows.
contract PayFuseToken is ERC2771Context, ERC20, ERC20Permit, Ownable {
    uint8 private immutable _tokenDecimals;

    /// @notice Max tokens dispensed per faucet() call (testnet only)
    uint256 public constant FAUCET_LIMIT = 10_000;

    event Faucet(address indexed to, uint256 amount);

    /// @param name_          Token name  (e.g. "PayFuse USD")
    /// @param symbol_        Token symbol (e.g. "pfUSD")
    /// @param decimals_      Decimal places (usually 6 for stablecoin, 18 for utility)
    /// @param initialSupply  Supply in whole units (decimals applied automatically)
    /// @param trustedForwarder  ERC-2771 forwarder address for gasless meta-tx
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply,
        address trustedForwarder
    )
        ERC2771Context(trustedForwarder)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
        Ownable(msg.sender)
    {
        _tokenDecimals = decimals_;
        _mint(msg.sender, initialSupply * 10 ** decimals_);
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    /// @notice Owner-only minting for controlled supply
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Public faucet for testnets — capped per call
    function faucet(uint256 amount) external {
        require(
            amount <= FAUCET_LIMIT * 10 ** _tokenDecimals,
            "PayFuseToken: faucet limit exceeded"
        );
        _mint(_msgSender(), amount);
        emit Faucet(_msgSender(), amount);
    }

    // ---- ERC-2771 overrides (gasless meta-tx support) ----

    function _msgSender()
        internal
        view
        override(Context, ERC2771Context)
        returns (address)
    {
        return ERC2771Context._msgSender();
    }

    function _msgData()
        internal
        view
        override(Context, ERC2771Context)
        returns (bytes calldata)
    {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength()
        internal
        view
        override(Context, ERC2771Context)
        returns (uint256)
    {
        return ERC2771Context._contextSuffixLength();
    }
}
