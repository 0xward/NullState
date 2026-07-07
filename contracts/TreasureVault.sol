// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TreasureVault
 * @notice Weekly treasure vault quest contract for NullState game
 * @dev Handles vault code management, reward distribution, and attempt tracking
 *
 * Features:
 * - Weekly randomized 4-digit codes (regenerate every Monday 00:00 UTC)
 * - Multi-token support: USDm, USDT, USDC, CELO
 * - Claim limit: 1x per week per user
 * - Attempt limit: Max 3 wrong attempts before lock until next week
 * - Separate reward pool (independent from burn & seasonal bonus pools)
 * - Backend-only code submission for security
 * - Owner can deposit/withdraw vault reward pool
 * - Immutable vault code records on-chain
 *
 * Quest Flow:
 * 1. User finds Paper (Epic) in Bunker 2, Floor 2 → Firebase stores weekly code
 * 2. User finds Golden Key (Legendary) in Bunker 1, Floor 3 → gets key
 * 3. User reaches Bunker 6, Floor 3 → Vault UI appears
 * 4. User inputs 4-digit code from Paper
 * 5. Backend validates via submitVaultCode() → user gets 1 USDm if correct
 * 6. Max 3 attempts per week, then locked until next week
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TreasureVault is Ownable {
    using Strings for uint256;

    // ============ Constants ============
    /// @dev Reward amount per successful vault claim (1 USDm with 18 decimals)
    uint256 public constant VAULT_REWARD = 1e18;

    /// @dev Maximum vault attempts per week before lockout
    uint256 public constant MAX_ATTEMPTS_PER_WEEK = 3;

    // ============ Token Addresses (Celo Mainnet) ============
    /// @dev USDm (Mento Dollar) - primary reward token
    IERC20 public usdmToken = IERC20(0x765DE816845861e75A25fCA122bb6898B8B1282a);

    /// @dev USDT - alternative reward token
    IERC20 public usdtToken = IERC20(0x88eeC42eaf6e1b371f4A7e786FdDB2e782b72cCA);

    /// @dev USDC - alternative reward token
    IERC20 public usdcToken = IERC20(0xEf63B1fDeFA2C442f41911160bCEFDAD5896e107);

    /// @dev CELO native token address marker
    address public constant celoToken = 0x471EcE3750Da237f93B8E339c536cb1483c48E8F;

    // ============ Vault Code Storage ============
    /// @notice Weekly vault codes (4-digit, regenerate every Monday 00:00 UTC)
    /// @dev Mapping: weekId (YYYYWW format) => 4-digit code string
    mapping(uint256 => string) public weeklyVaultCodes;

    /// @notice Track if code already set for week (prevent overwrite)
    mapping(uint256 => bool) public codeSetForWeek;

    // ============ Claim Tracking ============
    /// @notice User claims per week (1x per week limit)
    /// @dev Mapping: user => weekId => claimed
    mapping(address => mapping(uint256 => bool)) public vaultClaimedThisWeek;

    /// @notice User attempt counts per week
    /// @dev Mapping: user => weekId => attempt count (max 3)
    mapping(address => mapping(uint256 => uint256)) public userVaultAttempts;

    /// @notice User lockout status per week (locked after 3 failed attempts)
    /// @dev Mapping: user => weekId => locked
    mapping(address => mapping(uint256 => bool)) public userVaultLocked;

    // ============ Reward Pool Management ============
    /// @notice Total USDm/USDT/USDC deposited into vault reward pool by owner
    uint256 public totalVaultPoolDeposited;

    /// @notice Total USDm/USDT/USDC claimed from vault pool by users
    uint256 public totalVaultPoolClaimed;

    /// @notice Current reward token being used (USDm default)
    address public currentRewardToken;

    // ============ Backend Authorization ============
    /// @notice Authorized backend addresses that can submit vault codes
    mapping(address => bool) public backendAddresses;

    // ============ Events ============
    /// @notice Emitted when owner deposits into vault reward pool
    event VaultPoolDeposited(address indexed token, uint256 amount, uint256 totalPool);

    /// @notice Emitted when owner withdraws from vault reward pool
    event VaultPoolWithdrawn(address indexed token, uint256 amount, uint256 remainingPool);

    /// @notice Emitted when weekly vault code is set by backend
    event WeeklyCodeSet(uint256 indexed weekId, uint256 timestamp);

    /// @notice Emitted when user submits correct vault code and claims reward
    event VaultCodeCorrect(address indexed user, uint256 indexed weekId, uint256 reward);

    /// @notice Emitted when user submits wrong vault code
    event VaultCodeIncorrect(address indexed user, uint256 indexed weekId, uint256 attemptNumber);

    /// @notice Emitted when user reaches max attempts and gets locked
    event VaultLocked(address indexed user, uint256 indexed weekId);

    /// @notice Emitted when backend unlocks user for new week
    event VaultUnlockedForNewWeek(address indexed user, uint256 indexed newWeekId);

    /// @notice Emitted when backend address authorization changes
    event BackendAddressUpdated(address indexed backend, bool isAuthorized);

    /// @notice Emitted when reward token switches
    event RewardTokenSwitched(address indexed newToken);

    // ============ Modifiers ============
    /// @dev Only authorized backend addresses or owner can call
    modifier onlyBackend() {
        require(backendAddresses[msg.sender] || msg.sender == owner(), "Not authorized backend");
        _;
    }

    // ============ Constructor ============
    constructor() {
        // @dev Initialize with USDm as default reward token
        currentRewardToken = address(usdmToken);
    }

    // ============ Backend Authorization Management ============

    /// @notice Add or remove backend authorization
    /// @dev Only owner can manage backend addresses
    /// @param _backend Backend address to authorize/revoke
    /// @param _isBackend True to authorize, false to revoke
    function setBackendAddress(address _backend, bool _isBackend) external onlyOwner {
        require(_backend != address(0), "Invalid backend address");
        backendAddresses[_backend] = _isBackend;
        emit BackendAddressUpdated(_backend, _isBackend);
    }

    // ============ Reward Token Management ============

    /// @notice Switch reward token (for future flexibility)
    /// @dev Only owner can change reward token
    /// @param _newToken Address of new reward token (must be USDm, USDT, USDC, or CELO)
    function setRewardToken(address _newToken) external onlyOwner {
        require(
            _newToken == address(usdmToken) ||
            _newToken == address(usdtToken) ||
            _newToken == address(usdcToken) ||
            _newToken == celoToken,
            "Unsupported token"
        );
        currentRewardToken = _newToken;
        emit RewardTokenSwitched(_newToken);
    }

    // ============ Vault Pool Management ============

    /// @notice Owner deposits into vault reward pool
    /// @dev Accepts any supported token, tracks total deposited
    /// @param _token Token address (USDm, USDT, USDC, or CELO)
    /// @param _amount Amount to deposit (in wei)
    function depositVaultPool(address _token, uint256 _amount) external onlyOwner {
        require(
            _token == address(usdmToken) ||
            _token == address(usdtToken) ||
            _token == address(usdcToken) ||
            _token == celoToken,
            "Unsupported token"
        );
        require(_amount > 0, "Amount must be > 0");

        // @dev Transfer tokens from owner to contract
        if (_token != celoToken) {
            require(
                IERC20(_token).transferFrom(msg.sender, address(this), _amount),
                "Transfer failed"
            );
        } else {
            // @dev For CELO, payment via msg.value handled separately
            require(msg.value >= _amount, "Insufficient CELO");
        }

        totalVaultPoolDeposited += _amount;
        emit VaultPoolDeposited(_token, _amount, totalVaultPoolDeposited);
    }

    /// @notice Owner withdraws from vault reward pool
    /// @dev Can only withdraw more than claimed (maintains pool for players)
    /// @param _token Token to withdraw
    /// @param _amount Amount to withdraw
    function withdrawVaultPool(address _token, uint256 _amount) external onlyOwner {
        uint256 availableFunds = totalVaultPoolDeposited - totalVaultPoolClaimed;
        require(_amount <= availableFunds, "Cannot withdraw - claimed funds locked");
        require(_amount > 0, "Amount must be > 0");

        // @dev Transfer tokens back to owner
        if (_token != celoToken) {
            require(IERC20(_token).transfer(msg.sender, _amount), "Transfer failed");
        } else {
            (bool success, ) = msg.sender.call{value: _amount}("");
            require(success, "CELO transfer failed");
        }

        totalVaultPoolDeposited -= _amount;
        emit VaultPoolWithdrawn(_token, _amount, totalVaultPoolDeposited);
    }

    /// @notice Get available vault reward funds
    /// @return Available USDm/USDT/USDC for future claims
    function getAvailableVaultFunds() external view returns (uint256) {
        return totalVaultPoolDeposited - totalVaultPoolClaimed;
    }

    // ============ Weekly Vault Code Management ============

    /// @notice Backend stores weekly vault code (should run every Monday 00:00 UTC)
    /// @dev Only backend or owner can set codes, prevents overwrite
    /// @param _weekId Week identifier in YYYYWW format (e.g., 202627 for week 27 of 2026)
    /// @param _code 4-digit code string (must be digits only: "1234")
    function storeWeeklyVaultCode(uint256 _weekId, string calldata _code) external onlyBackend {
        require(_weekId > 0, "Invalid week ID");
        require(bytes(_code).length == 4, "Code must be 4 digits");
        require(!codeSetForWeek[_weekId], "Code already set for this week");

        // @dev Validate all characters are digits (0-9)
        bytes memory codeBytes = bytes(_code);
        for (uint256 i = 0; i < 4; i++) {
            require(codeBytes[i] >= 0x30 && codeBytes[i] <= 0x39, "Code must contain only digits");
        }

        // @dev Store code and mark week as set
        weeklyVaultCodes[_weekId] = _code;
        codeSetForWeek[_weekId] = true;

        emit WeeklyCodeSet(_weekId, block.timestamp);
    }

    /// @notice Get vault code for specific week
    /// @param _weekId Week identifier (YYYYWW format)
    /// @return Code string (empty if not set yet)
    function getWeeklyVaultCode(uint256 _weekId) external view returns (string memory) {
        return weeklyVaultCodes[_weekId];
    }

    /// @notice Check if code is set for week
    /// @param _weekId Week identifier (YYYYWW format)
    /// @return True if code already set for this week
    function isCodeSetForWeek(uint256 _weekId) external view returns (bool) {
        return codeSetForWeek[_weekId];
    }

    // ============ Vault Code Submission & Claiming ============

    /// @notice Submit vault code and claim 1 USDm reward if correct
    /// @dev Backend calls this after user inputs code in UI
    /// @dev Only 1 claim per user per week, max 3 attempts before lockout
    /// @param _user User address claiming reward
    /// @param _weekId Current week ID (YYYYWW format)
    /// @param _code Submitted 4-digit code
    function submitVaultCode(
        address _user,
        uint256 _weekId,
        string calldata _code
    ) external onlyBackend {
        require(_user != address(0), "Invalid user address");
        require(_weekId > 0, "Invalid week ID");
        require(codeSetForWeek[_weekId], "Code not set for this week");
        require(!vaultClaimedThisWeek[_user][_weekId], "Already claimed this week");
        require(!userVaultLocked[_user][_weekId], "Locked - too many failed attempts");
        require(userVaultAttempts[_user][_weekId] < MAX_ATTEMPTS_PER_WEEK, "Max attempts reached");

        // @dev Increment attempt counter
        userVaultAttempts[_user][_weekId]++;

        // @dev Check if code matches (compare string hashes)
        bool isCorrect = keccak256(abi.encodePacked(_code)) == 
                         keccak256(abi.encodePacked(weeklyVaultCodes[_weekId]));

        if (isCorrect) {
            // ========== CORRECT CODE ==========
            // @dev Mark as claimed and transfer reward
            vaultClaimedThisWeek[_user][_weekId] = true;
            totalVaultPoolClaimed += VAULT_REWARD;

            // @dev Transfer 1 USDm reward to user
            require(
                totalVaultPoolClaimed <= totalVaultPoolDeposited,
                "Insufficient vault pool"
            );

            if (currentRewardToken != celoToken) {
                require(
                    IERC20(currentRewardToken).transfer(_user, VAULT_REWARD),
                    "Transfer failed"
                );
            } else {
                // @dev Send CELO native
                (bool success, ) = _user.call{value: VAULT_REWARD}("");
                require(success, "CELO transfer failed");
            }

            emit VaultCodeCorrect(_user, _weekId, VAULT_REWARD);
        } else {
            // ========== INCORRECT CODE ==========
            // @dev Log incorrect attempt
            emit VaultCodeIncorrect(_user, _weekId, userVaultAttempts[_user][_weekId]);

            // @dev If 3 attempts reached, lock user for this week
            if (userVaultAttempts[_user][_weekId] >= MAX_ATTEMPTS_PER_WEEK) {
                userVaultLocked[_user][_weekId] = true;
                emit VaultLocked(_user, _weekId);
            }
        }
    }

    // ============ Weekly Reset Management ============

    /// @notice Backend unlocks user for new week (runs every Monday 00:00 UTC)
    /// @dev Resets attempt counter and lockout status for new week
    /// @param _user User to unlock
    /// @param _newWeekId New week ID (YYYYWW format)
    function unlockVaultForNewWeek(address _user, uint256 _newWeekId) external onlyBackend {
        require(_user != address(0), "Invalid user address");
        require(_newWeekId > 0, "Invalid week ID");

        // @dev Reset attempts and lockout for new week
        userVaultAttempts[_user][_newWeekId] = 0;
        userVaultLocked[_user][_newWeekId] = false;

        emit VaultUnlockedForNewWeek(_user, _newWeekId);
    }

    // ============ Query Functions ============

    /// @notice Get user's current attempt count for week
    /// @param _user User address
    /// @param _weekId Week ID
    /// @return Number of attempts used
    function getUserAttempts(address _user, uint256 _weekId) external view returns (uint256) {
        return userVaultAttempts[_user][_weekId];
    }

    /// @notice Get remaining attempts for user in week
    /// @param _user User address
    /// @param _weekId Week ID
    /// @return Remaining attempts (0 if locked)
    function getRemainingAttempts(address _user, uint256 _weekId) external view returns (uint256) {
        if (userVaultLocked[_user][_weekId]) return 0;
        uint256 used = userVaultAttempts[_user][_weekId];
        return used >= MAX_ATTEMPTS_PER_WEEK ? 0 : MAX_ATTEMPTS_PER_WEEK - used;
    }

    /// @notice Check if user has claimed vault reward this week
    /// @param _user User address
    /// @param _weekId Week ID
    /// @return True if already claimed
    function hasClaimedThisWeek(address _user, uint256 _weekId) external view returns (bool) {
        return vaultClaimedThisWeek[_user][_weekId];
    }

    /// @notice Check if user is locked out from vault this week
    /// @param _user User address
    /// @param _weekId Week ID
    /// @return True if locked (too many failed attempts)
    function isLockedThisWeek(address _user, uint256 _weekId) external view returns (bool) {
        return userVaultLocked[_user][_weekId];
    }

    /// @notice Get vault pool statistics
    /// @return deposited Total deposited by owner
    /// @return claimed Total claimed by users
    /// @return available Remaining available for claims
    function getVaultPoolStats()
        external
        view
        returns (
            uint256 deposited,
            uint256 claimed,
            uint256 available
        )
    {
        deposited = totalVaultPoolDeposited;
        claimed = totalVaultPoolClaimed;
        available = deposited > claimed ? deposited - claimed : 0;
    }

    // ============ Receive CELO Payments ============
    /// @dev Allow contract to receive CELO for pool deposits and reward transfers
    receive() external payable {}
}
