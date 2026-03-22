// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title POSPayment — Decentralised POS payment processor for Fuse Network
/// @notice Full order lifecycle (create → pay / cancel) with:
///   • Multi-token support (any ERC-20: USDC, pfUSD, FUSE-wrapped, etc.)
///   • Gasless transactions via ERC-2771 trusted forwarder
///   • Configurable platform fee in basis points
///   • Auto-expiry for unpaid orders
contract POSPayment is ERC2771Context, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    enum OrderStatus { Pending, Paid, Cancelled, Expired }

    struct PaymentOrder {
        bytes32   id;
        address   merchant;
        address   payer;
        address   currency;       // ERC-20 token address
        uint256   amount;         // gross amount (before fee)
        uint256   fee;            // platform fee deducted on pay
        OrderStatus status;
        uint256   createdAt;
        uint256   expiresAt;
        bytes32   txRef;          // optional external reference
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice Platform fee in basis points (100 = 1%, max 500 = 5%)
    uint256 public feeBps;

    /// @notice Address that receives platform fees
    address public feeCollector;

    /// @notice Default order TTL in seconds (30 minutes)
    uint256 public orderTTL = 30 minutes;

    /// @notice Whitelisted ERC-20 tokens accepted for payments
    mapping(address => bool) public supportedTokens;

    /// @notice All orders indexed by id
    mapping(bytes32 => PaymentOrder) public orders;

    /// @notice Merchant address → array of order ids (for listing)
    mapping(address => bytes32[]) public merchantOrders;

    /// @notice Auto-incrementing nonce used to derive unique order ids
    uint256 private _orderNonce;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event OrderCreated(
        bytes32 indexed orderId,
        address indexed merchant,
        address currency,
        uint256 amount,
        uint256 expiresAt
    );

    event OrderPaid(
        bytes32 indexed orderId,
        address indexed payer,
        address indexed merchant,
        address currency,
        uint256 amount,
        uint256 fee
    );

    event OrderCancelled(bytes32 indexed orderId, address indexed cancelledBy);

    event OrderExpired(bytes32 indexed orderId);

    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address oldCollector, address newCollector);
    event OrderTTLUpdated(uint256 oldTTL, uint256 newTTL);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error InvalidAddress();
    error InvalidAmount();
    error TokenNotSupported(address token);
    error OrderNotFound(bytes32 orderId);
    error OrderNotPending(bytes32 orderId);
    error OrderExpiredError(bytes32 orderId);
    error NotMerchant(bytes32 orderId);
    error FeeTooHigh(uint256 bps);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @param _feeBps            Initial platform fee in basis points
    /// @param _feeCollector      Address receiving fees
    /// @param _trustedForwarder  ERC-2771 forwarder for gasless meta-tx
    constructor(
        uint256 _feeBps,
        address _feeCollector,
        address _trustedForwarder
    ) ERC2771Context(_trustedForwarder) Ownable(msg.sender) {
        if (_feeBps > 500) revert FeeTooHigh(_feeBps);
        if (_feeCollector == address(0)) revert InvalidAddress();

        feeBps = _feeBps;
        feeCollector = _feeCollector;
    }

    // ──────────────────────────────────────────────
    //  Core — Order Lifecycle
    // ──────────────────────────────────────────────

    /// @notice Merchant creates a payment order customers can pay
    /// @param merchantAddress  Merchant wallet that will receive funds
    /// @param amount           Gross payment amount (fee applied on pay)
    /// @param currency         ERC-20 token address
    /// @return orderId         Unique order identifier
    function createPaymentOrder(
        address merchantAddress,
        uint256 amount,
        address currency
    ) external whenNotPaused returns (bytes32 orderId) {
        if (merchantAddress == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (!supportedTokens[currency]) revert TokenNotSupported(currency);

        _orderNonce++;
        orderId = keccak256(
            abi.encodePacked(block.chainid, address(this), _orderNonce)
        );

        uint256 expiry = block.timestamp + orderTTL;

        orders[orderId] = PaymentOrder({
            id: orderId,
            merchant: merchantAddress,
            payer: address(0),
            currency: currency,
            amount: amount,
            fee: 0,
            status: OrderStatus.Pending,
            createdAt: block.timestamp,
            expiresAt: expiry,
            txRef: bytes32(0)
        });

        merchantOrders[merchantAddress].push(orderId);

        emit OrderCreated(orderId, merchantAddress, currency, amount, expiry);
    }

    /// @notice Customer pays an existing order
    /// @param orderId  The order to pay
    function payOrder(bytes32 orderId) external nonReentrant whenNotPaused {
        PaymentOrder storage order = orders[orderId];
        if (order.merchant == address(0)) revert OrderNotFound(orderId);
        if (order.status != OrderStatus.Pending) revert OrderNotPending(orderId);

        // auto-expire
        if (block.timestamp > order.expiresAt) {
            order.status = OrderStatus.Expired;
            emit OrderExpired(orderId);
            revert OrderExpiredError(orderId);
        }

        address payer = _msgSender();
        uint256 fee = (order.amount * feeBps) / 10_000;
        uint256 merchantAmount = order.amount - fee;

        IERC20 token = IERC20(order.currency);
        token.safeTransferFrom(payer, order.merchant, merchantAmount);
        if (fee > 0) {
            token.safeTransferFrom(payer, feeCollector, fee);
        }

        order.payer = payer;
        order.fee = fee;
        order.status = OrderStatus.Paid;

        emit OrderPaid(
            orderId,
            payer,
            order.merchant,
            order.currency,
            order.amount,
            fee
        );
    }

    /// @notice Cancel a pending order — only the merchant who created it
    /// @param orderId  The order to cancel
    function cancelOrder(bytes32 orderId) external {
        PaymentOrder storage order = orders[orderId];
        if (order.merchant == address(0)) revert OrderNotFound(orderId);
        if (order.status != OrderStatus.Pending) revert OrderNotPending(orderId);
        if (_msgSender() != order.merchant) revert NotMerchant(orderId);

        order.status = OrderStatus.Cancelled;
        emit OrderCancelled(orderId, _msgSender());
    }

    /// @notice Read full order details
    function getOrderDetails(
        bytes32 orderId
    ) external view returns (PaymentOrder memory) {
        PaymentOrder memory order = orders[orderId];
        if (order.merchant == address(0)) revert OrderNotFound(orderId);
        return order;
    }

    /// @notice List all order ids for a merchant
    function getMerchantOrders(
        address merchant
    ) external view returns (bytes32[] memory) {
        return merchantOrders[merchant];
    }

    /// @notice Count orders for a merchant
    function getMerchantOrderCount(
        address merchant
    ) external view returns (uint256) {
        return merchantOrders[merchant].length;
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    function addSupportedToken(address token) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    function setFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > 500) revert FeeTooHigh(_feeBps);
        uint256 old = feeBps;
        feeBps = _feeBps;
        emit FeeUpdated(old, _feeBps);
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert InvalidAddress();
        address old = feeCollector;
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(old, _feeCollector);
    }

    function setOrderTTL(uint256 _ttl) external onlyOwner {
        uint256 old = orderTTL;
        orderTTL = _ttl;
        emit OrderTTLUpdated(old, _ttl);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ──────────────────────────────────────────────
    //  ERC-2771 overrides (gasless meta-tx)
    // ──────────────────────────────────────────────

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
