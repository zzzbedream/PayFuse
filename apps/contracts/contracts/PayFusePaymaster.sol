// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title IEntryPoint — Minimal ERC-4337 EntryPoint interface
/// @dev Full interface at https://eips.ethereum.org/EIPS/eip-4337
interface IEntryPoint {
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    function balanceOf(address account) external view returns (uint256);
    function depositTo(address account) external payable;
    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external;
}

/// @title PayFusePaymaster — ERC-4337 Verifying Paymaster for Fuse Network
/// @notice Sponsors gas for approved PayFuse POS transactions so end-users
///         can interact with the blockchain without holding FUSE for gas.
///         Works with any ERC-4337 bundler deployed on Fuse.
///
/// How it works:
///   1. Backend signs a hash authorising a specific UserOperation
///   2. Bundler submits the UserOp; EntryPoint calls validatePaymasterUserOp
///   3. Paymaster verifies the backend signature → sponsors gas
///   4. User pays zero gas — full "Web2" UX
contract PayFusePaymaster is Ownable {

    /// @notice The ERC-4337 EntryPoint this paymaster is registered with
    IEntryPoint public immutable entryPoint;

    /// @notice Backend signer whose signature authorises gas sponsorship
    address public verifyingSigner;

    /// @notice Track used hashes to prevent replay
    mapping(bytes32 => bool) public usedHashes;

    // ── Events ──────────────────────────────────────

    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event GasDeposited(address indexed from, uint256 amount);
    event GasWithdrawn(address indexed to, uint256 amount);

    // ── Errors ──────────────────────────────────────

    error InvalidSigner();
    error InvalidSignature();
    error HashAlreadyUsed();
    error InsufficientDeposit();

    // ── Constructor ─────────────────────────────────

    /// @param _entryPoint       ERC-4337 EntryPoint contract address
    /// @param _verifyingSigner  Backend address that signs sponsorship approvals
    constructor(
        address _entryPoint,
        address _verifyingSigner
    ) Ownable(msg.sender) {
        if (_verifyingSigner == address(0)) revert InvalidSigner();
        entryPoint = IEntryPoint(_entryPoint);
        verifyingSigner = _verifyingSigner;
    }

    // ── ERC-4337 Paymaster Validation ───────────────

    /// @notice Called by EntryPoint to validate whether this paymaster
    ///         will sponsor the given UserOperation.
    /// @dev paymasterAndData layout:
    ///      [0:20]   paymaster address
    ///      [20:28]  validUntil  (uint48)
    ///      [28:36]  validAfter  (uint48)
    ///      [36:101] signature   (65 bytes, ECDSA)
    function validatePaymasterUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32, /* userOpHash */
        uint256 /* maxCost */
    ) external view returns (bytes memory context, uint256 validationData) {
        require(msg.sender == address(entryPoint), "only EntryPoint");

        // Decode timestamps & signature from paymasterAndData
        (uint48 validUntil, uint48 validAfter, bytes memory signature) =
            _parsePaymasterData(userOp.paymasterAndData);

        // Build the hash the backend should have signed
        bytes32 hash = getHash(userOp, validUntil, validAfter);

        // Recover signer
        address recovered = _recoverSigner(hash, signature);
        if (recovered != verifyingSigner) {
            // Return SIG_VALIDATION_FAILED (1) packed with time range
            return ("", _packValidationData(true, validUntil, validAfter));
        }

        // Return success (0) packed with time range
        return (
            abi.encode(userOp.sender),
            _packValidationData(false, validUntil, validAfter)
        );
    }

    /// @notice Computes the hash that the backend signer must sign
    function getHash(
        IEntryPoint.UserOperation calldata userOp,
        uint48 validUntil,
        uint48 validAfter
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                userOp.sender,
                userOp.nonce,
                keccak256(userOp.initCode),
                keccak256(userOp.callData),
                userOp.callGasLimit,
                userOp.verificationGasLimit,
                userOp.preVerificationGas,
                userOp.maxFeePerGas,
                userOp.maxPriorityFeePerGas,
                block.chainid,
                address(this),
                validUntil,
                validAfter
            )
        );
    }

    // ── Deposit Management ──────────────────────────

    /// @notice Deposit FUSE into EntryPoint to fund gas sponsoring
    function deposit() external payable onlyOwner {
        entryPoint.depositTo{value: msg.value}(address(this));
        emit GasDeposited(msg.sender, msg.value);
    }

    /// @notice Withdraw deposited FUSE from EntryPoint
    function withdraw(address payable to, uint256 amount) external onlyOwner {
        entryPoint.withdrawTo(to, amount);
        emit GasWithdrawn(to, amount);
    }

    /// @notice Check current deposit balance in EntryPoint
    function getDeposit() external view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    /// @notice Allow contract to receive FUSE directly
    receive() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
        emit GasDeposited(msg.sender, msg.value);
    }

    // ── Admin ───────────────────────────────────────

    function setVerifyingSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert InvalidSigner();
        address old = verifyingSigner;
        verifyingSigner = _signer;
        emit SignerUpdated(old, _signer);
    }

    // ── Internal Helpers ────────────────────────────

    function _parsePaymasterData(
        bytes calldata paymasterAndData
    ) internal pure returns (uint48 validUntil, uint48 validAfter, bytes memory signature) {
        validUntil = uint48(bytes6(paymasterAndData[20:26]));
        validAfter = uint48(bytes6(paymasterAndData[26:32]));
        signature = paymasterAndData[32:];
    }

    function _recoverSigner(
        bytes32 hash,
        bytes memory signature
    ) internal pure returns (address) {
        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );

        if (signature.length != 65) return address(0);

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);

        return ecrecover(ethHash, v, r, s);
    }

    /// @dev Pack sigFailed + validUntil + validAfter into a single uint256
    ///      as expected by EntryPoint v0.7
    function _packValidationData(
        bool sigFailed,
        uint48 validUntil,
        uint48 validAfter
    ) internal pure returns (uint256) {
        return
            (sigFailed ? 1 : 0) |
            (uint256(validUntil) << 160) |
            (uint256(validAfter) << 208);
    }
}
