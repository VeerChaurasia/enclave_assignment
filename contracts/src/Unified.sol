// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Unified {
    // Storage slots as raw bytes32 keys
    bytes32 private constant RECIPIENT_SLOT = keccak256("unified.deposit.recipient");
    bytes32 private constant RELAYER_SLOT = keccak256("unified.deposit.relayer");
    bytes32 private constant USDC_SLOT = keccak256("unified.deposit.usdc");

    event TokensForwarded(
        address indexed token,
        uint256 amount,
        address indexed recipient,
        address indexed forwarder,
        uint256 timestamp
    );

    error AlreadyInitialized();
    error UnauthorizedRelayer();
    error InvalidToken();
    error InvalidAmount();
    error TransferFailed();

    function initialize(address _recipient, address _relayer, address _usdc) external {
        if (_loadAddress(RECIPIENT_SLOT) != address(0)) revert AlreadyInitialized();

        _storeAddress(RECIPIENT_SLOT, _recipient);
        _storeAddress(RELAYER_SLOT, _relayer);
        _storeAddress(USDC_SLOT, _usdc);
    }

    function forwardToken() external {
        address relayer = _loadAddress(RELAYER_SLOT);
        if (msg.sender != relayer) revert UnauthorizedRelayer();

        address token = _loadAddress(USDC_SLOT);
        address recipient = _loadAddress(RECIPIENT_SLOT);

        if (token == address(0) || recipient == address(0)) revert InvalidToken();

        IERC20 usdc = IERC20(token);
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert InvalidAmount();

        bool success = usdc.transfer(recipient, balance);
        if (!success) revert TransferFailed();

        emit TokensForwarded(token, balance, recipient, msg.sender, block.timestamp);
    }

    function getRecipient() public view returns (address) {
        return _loadAddress(RECIPIENT_SLOT);
    }

    function getRelayer() public view returns (address) {
        return _loadAddress(RELAYER_SLOT);
    }

    function getUSDC() public view returns (address) {
        return _loadAddress(USDC_SLOT);
    }

    function isInitialized() external view returns (bool) {
        return getRecipient() != address(0) && getRelayer() != address(0) && getUSDC() != address(0);
    }

    function getUSDCBalance() external view returns (uint256) {
        return IERC20(getUSDC()).balanceOf(address(this));
    }
    function _storeAddress(bytes32 slot, address value) internal {
        assembly {
            sstore(slot, value)
        }
    }
    function _loadAddress(bytes32 slot) internal view returns (address addr) {
        assembly {
            addr := sload(slot)
        }
    }
}
