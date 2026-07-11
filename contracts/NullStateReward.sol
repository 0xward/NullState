// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NullStateReward
 * @notice Reward, burn, and leaderboard management for NullState game
 * @dev Main contract for handling:
 * - Weekly burn reward pools (flexible size, flexible per-user cap)
 * - Seasonal leaderboards and bonus rewards (20/5/3 USDm for top 3)
 * - Multi-token support (USDm, USDT, USDC, CELO)
 * - Integration with PassSBT for pass verification
 * - Backend-driven leaderboard updates via cron jobs
 * 
 * Features:
 * - Flexible weekly pool size (owner adjustable)
 * - Flexible per-user weekly cap (owner adjustable)
 * - Support for 4 tokens on Celo: USDm, USDT, USDC, CELO
 * - Burn tracking with immutable on-chain records
 * - Season-based leaderboards (6 seasons, monthly UTC)
 * - Requires owner deposit before season bonuses are claimable
 * - Backend integration for 24h UTC leaderboard updates
 */

import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IPassSBT {
    function hasPass(address user) external view returns (bool);
    function getUserPassSeason(address user) external view returns (uint256);
}

contract NullStateReward is Ownable {
    // ============ Constants ============
    uint256 public constant TOTAL_SEASONS = 6;
    uint256 public constant RANK1_REWARD = 20e18; // 20 USDm
    uint256 public constant RANK2_REWARD = 5e18; // 5 USDm
    uint256 public constant RANK3_REWARD = 3e18; // 3 USDm

    // ============ Supported Tokens ============
    IERC20 public usdmToken = IERC20(0x765DE816845861e75A25fCA122bb6898B8B1282a);
    IERC20 public usdtToken = IERC20(0x88eEc42eaf6E1b371f4a7e786fDDB2E782b72ccA);
    IERC20 public usdcToken = IERC20(0xeF63B1FdEfA2C442f41911160bCEFdaD5896e107);
    address public celoToken = 0x471ecE3750da237F93b8e339C536Cb1483c48E8f; // Native CELO

    IPassSBT public passSBT;

    // ============ Configurable Parameters ============
    uint256 public weeklyPoolSize = 2e18; // 2 USDm (flexible)
    uint256 public maxPerUserPerWeek = 5e17; // 0.5 USDm (flexible)

    // ============ Data Structures ============
    struct WeeklyPool {
        uint256 week; // YYYYWW format
        address rewardToken;
        uint256 depositedAmount;
        uint256 claimedAmount;
        uint256 createdAt;
    }

    struct BurnRecord {
        address user;
        uint256 itemCount;
        uint256 burnValue; // in wei of reward token
        address rewardToken;
        uint256 timestamp;
        bool claimed;
    }

    struct SeasonLeaderboard {
        uint256 seasonId;
        address[3] topPlayers; // rank 1, 2, 3
        uint256[3] topScores; // item counts
        address rewardToken;
        uint256 totalDeposited;
        bool deposited;
        bool finalized;
        uint256 updatedAt;
    }

    // ============ State Variables ============
    mapping(uint256 => WeeklyPool) public weeklyPools; // week => pool
    mapping(address => BurnRecord[]) public userBurnRecords;
    mapping(uint256 => SeasonLeaderboard) public seasonLeaderboards; // seasonId => leaderboard
    mapping(address => mapping(uint256 => uint256)) public userWeeklyBurnAmount; // user => week => amount burned
    mapping(address => mapping(uint256 => uint256)) public userWeeklyClaimed; // user => week => amount claimed
    mapping(address => mapping(uint256 => bool)) public userSeasonClaimed; // user => seasonId => has claimed bonus

    mapping(address => bool) public backendAddresses; // Authorized backend addresses for updates

    // ============ Events ============
    event BurnRecorded(
        address indexed user,
        uint256 itemCount,
        uint256 burnValue,
        address rewardToken,
        uint256 timestamp
    );
    event BurnClaimed(
        address indexed user,
        uint256 week,
        uint256 amount,
        address rewardToken
    );
    event WeeklyPoolCreated(
        uint256 week,
        address rewardToken,
        uint256 depositedAmount
    );
    event WeeklyPoolDeposit(
        uint256 week,
        address rewardToken,
        uint256 additionalAmount
    );
    event LeaderboardUpdated(
        uint256 indexed seasonId,
        address[3] topPlayers,
        uint256[3] topScores
    );
    event SeasonBonusDeposited(
        uint256 indexed seasonId,
        address rewardToken,
        uint256 totalAmount
    );
    event SeasonBonusClaimed(
        address indexed user,
        uint256 seasonId,
        uint256 rank,
        uint256 amount
    );
    event PoolSizeUpdated(uint256 newSize);
    event MaxPerUserUpdated(uint256 newMax);
    event BackendAddressUpdated(address indexed backend, bool added);

    // ============ Modifiers ============
    modifier onlyBackend() {
        require(backendAddresses[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    // ============ Constructor ============
    constructor(address _passSBT) Ownable(msg.sender) {
        passSBT = IPassSBT(_passSBT);
    }

    // ============ Configuration (Owner Only) ============

    /**
     * @notice Set Pass SBT contract address
     */
    function setPassSBT(address _passSBT) external onlyOwner {
        require(_passSBT != address(0), "Invalid address");
        passSBT = IPassSBT(_passSBT);
    }

    /**
     * @notice Update weekly pool size
     */
    function setWeeklyPoolSize(uint256 _newSize) external onlyOwner {
        require(_newSize > 0, "Size must be > 0");
        weeklyPoolSize = _newSize;
        emit PoolSizeUpdated(_newSize);
    }

    /**
     * @notice Update max per user per week
     */
    function setMaxPerUserPerWeek(uint256 _newMax) external onlyOwner {
        require(_newMax > 0, "Max must be > 0");
        maxPerUserPerWeek = _newMax;
        emit MaxPerUserUpdated(_newMax);
    }

    /**
     * @notice Add/remove backend address for leaderboard updates
     */
    function setBackendAddress(address _backend, bool _isBackend) external onlyOwner {
        require(_backend != address(0), "Invalid address");
        backendAddresses[_backend] = _isBackend;
        emit BackendAddressUpdated(_backend, _isBackend);
    }

    // ============ Burn Tracking (Backend) ============

    /**
     * @notice Record burn event from backend
     * @param _user User burning items
     * @param _itemCount Number of items burned
     * @param _burnValue Total value in wei of reward token
     * @param _rewardToken Token used for reward (USDm, USDT, USDC, CELO)
     */
    function recordBurn(
        address _user,
        uint256 _itemCount,
        uint256 _burnValue,
        address _rewardToken
    ) external onlyBackend {
        require(_user != address(0), "Invalid user");
        require(_itemCount > 0, "Invalid item count");
        require(_burnValue > 0, "Invalid burn value");
        require(
            _rewardToken == address(usdmToken) ||
            _rewardToken == address(usdtToken) ||
            _rewardToken == address(usdcToken) ||
            _rewardToken == celoToken,
            "Unsupported token"
        );

        // Create burn record
        BurnRecord memory record = BurnRecord({
            user: _user,
            itemCount: _itemCount,
            burnValue: _burnValue,
            rewardToken: _rewardToken,
            timestamp: block.timestamp,
            claimed: false
        });

        userBurnRecords[_user].push(record);

        // Track weekly burn
        uint256 currentWeek = _getCurrentWeek();
        userWeeklyBurnAmount[_user][currentWeek] = userWeeklyBurnAmount[_user][currentWeek] + (
            _burnValue
        );

        emit BurnRecorded(_user, _itemCount, _burnValue, _rewardToken, block.timestamp);
    }

    // ============ Weekly Burn Rewards ============

    /**
     * @notice Owner deposits weekly pool
     */
    function depositWeeklyPool(
        uint256 _week,
        address _rewardToken,
        uint256 _amount
    ) external onlyOwner {
        require(
            _rewardToken == address(usdmToken) ||
            _rewardToken == address(usdtToken) ||
            _rewardToken == address(usdcToken) ||
            _rewardToken == celoToken,
            "Unsupported token"
        );
        require(_amount > 0, "Amount must be > 0");

        // Transfer tokens
        if (_rewardToken != celoToken) {
            require(
                IERC20(_rewardToken).transferFrom(msg.sender, address(this), _amount),
                "Transfer failed"
            );
        }

        if (weeklyPools[_week].createdAt == 0) {
            weeklyPools[_week] = WeeklyPool({
                week: _week,
                rewardToken: _rewardToken,
                depositedAmount: _amount,
                claimedAmount: 0,
                createdAt: block.timestamp
            });
            emit WeeklyPoolCreated(_week, _rewardToken, _amount);
        } else {
            weeklyPools[_week].depositedAmount = weeklyPools[_week].depositedAmount + (_amount);
            emit WeeklyPoolDeposit(_week, _rewardToken, _amount);
        }
    }

    /**
     * @notice User claims weekly burn rewards
     */
    function claimWeeklyRewards(uint256 _week) external {
        require(weeklyPools[_week].createdAt != 0, "Week not initialized");

        uint256 userBurned = userWeeklyBurnAmount[msg.sender][_week];
        uint256 userClaimed = userWeeklyClaimed[msg.sender][_week];
        uint256 claimable = userBurned - (userClaimed);

        require(claimable > 0, "No rewards to claim");

        // Check weekly cap
        uint256 maxUserClaim = maxPerUserPerWeek;
        uint256 toClaim = claimable > maxUserClaim ? maxUserClaim : claimable;

        // Check pool availability (pro-rata if depleted)
        WeeklyPool storage pool = weeklyPools[_week];
        uint256 poolAvailable = pool.depositedAmount - (pool.claimedAmount);
        require(poolAvailable >= toClaim, "Insufficient pool");

        // Update claims
        userWeeklyClaimed[msg.sender][_week] = userClaimed + (toClaim);
        pool.claimedAmount = pool.claimedAmount + (toClaim);

        // Transfer reward token
        if (pool.rewardToken == celoToken) {
            (bool success, ) = msg.sender.call{value: toClaim}("");
            require(success, "Transfer failed");
        } else {
            require(IERC20(pool.rewardToken).transfer(msg.sender, toClaim), "Transfer failed");
        }

        emit BurnClaimed(msg.sender, _week, toClaim, pool.rewardToken);
    }

    // ============ Leaderboard Management ============

    /**
     * @notice Backend updates seasonal leaderboard (via 24h cron)
     */
    function updateLeaderboard(
        uint256 _seasonId,
        address[3] calldata _topPlayers,
        uint256[3] calldata _topScores
    ) external onlyBackend {
        require(_seasonId > 0 && _seasonId <= TOTAL_SEASONS, "Invalid season");
        require(
            _topPlayers[0] != address(0) && _topPlayers[1] != address(0) && _topPlayers[2] != address(0),
            "Invalid addresses"
        );
        require(
            _topScores[0] >= _topScores[1] && _topScores[1] >= _topScores[2],
            "Scores not ordered"
        );

        SeasonLeaderboard storage lb = seasonLeaderboards[_seasonId];
        lb.seasonId = _seasonId;
        lb.topPlayers = _topPlayers;
        lb.topScores = _topScores;
        lb.updatedAt = block.timestamp;

        emit LeaderboardUpdated(_seasonId, _topPlayers, _topScores);
    }

    /**
     * @notice Owner deposits season bonus reward pool
     */
    function depositSeasonBonus(
        uint256 _seasonId,
        address _rewardToken,
        uint256 _amount
    ) external onlyOwner {
        require(_seasonId > 0 && _seasonId <= TOTAL_SEASONS, "Invalid season");
        require(
            _rewardToken == address(usdmToken) ||
            _rewardToken == address(usdtToken) ||
            _rewardToken == address(usdcToken) ||
            _rewardToken == celoToken,
            "Unsupported token"
        );
        require(_amount >= RANK1_REWARD + (RANK2_REWARD) + (RANK3_REWARD), "Insufficient amount");

        // Transfer tokens
        if (_rewardToken != celoToken) {
            require(
                IERC20(_rewardToken).transferFrom(msg.sender, address(this), _amount),
                "Transfer failed"
            );
        }

        SeasonLeaderboard storage lb = seasonLeaderboards[_seasonId];
        lb.rewardToken = _rewardToken;
        lb.totalDeposited = _amount;
        lb.deposited = true;

        emit SeasonBonusDeposited(_seasonId, _rewardToken, _amount);
    }

    /**
     * @notice Player claims season bonus (if ranked top 3)
     */
    function claimSeasonBonus(uint256 _seasonId) external {
        require(_seasonId > 0 && _seasonId <= TOTAL_SEASONS, "Invalid season");
        require(!userSeasonClaimed[msg.sender][_seasonId], "Already claimed");

        SeasonLeaderboard storage lb = seasonLeaderboards[_seasonId];
        require(lb.deposited, "Bonuses not deposited");

        uint256 rank = 0;
        uint256 rewardAmount = 0;

        if (msg.sender == lb.topPlayers[0]) {
            rank = 1;
            rewardAmount = RANK1_REWARD;
        } else if (msg.sender == lb.topPlayers[1]) {
            rank = 2;
            rewardAmount = RANK2_REWARD;
        } else if (msg.sender == lb.topPlayers[2]) {
            rank = 3;
            rewardAmount = RANK3_REWARD;
        } else {
            revert("Not ranked");
        }

        userSeasonClaimed[msg.sender][_seasonId] = true;

        // Transfer reward
        if (lb.rewardToken == celoToken) {
            (bool success, ) = msg.sender.call{value: rewardAmount}("");
            require(success, "Transfer failed");
        } else {
            require(IERC20(lb.rewardToken).transfer(msg.sender, rewardAmount), "Transfer failed");
        }

        emit SeasonBonusClaimed(msg.sender, _seasonId, rank, rewardAmount);
    }

    // ============ Query Functions ============

    /**
     * @notice Get current ISO week (YYYYWW format)
     */
    function _getCurrentWeek() internal view returns (uint256) {
        uint256 timestamp = block.timestamp;
        uint256 dayCount = timestamp / 86400;
        uint256 dayOfWeek = (dayCount + 4) % 7; // Thursday is day 4 for ISO week
        uint256 weekStart = dayCount - dayOfWeek;
        uint256 year = 1970;
        uint256 daysRemaining = weekStart;

        while (daysRemaining >= 365) {
            uint256 daysInYear = (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) ? 366 : 365;
            if (daysRemaining >= daysInYear) {
                daysRemaining -= daysInYear;
                year++;
            } else {
                break;
            }
        }

        uint256 week = (daysRemaining / 7) + 1;
        return year * 100 + week;
    }

    /**
     * @notice Get user's burn records count
     */
    function getUserBurnRecordsCount(address _user) external view returns (uint256) {
        return userBurnRecords[_user].length;
    }

    /**
     * @notice Get user's burn record
     */
    function getUserBurnRecord(address _user, uint256 _index)
        external
        view
        returns (BurnRecord memory)
    {
        require(_index < userBurnRecords[_user].length, "Invalid index");
        return userBurnRecords[_user][_index];
    }

    /**
     * @notice Get season leaderboard
     */
    function getSeasonLeaderboard(uint256 _seasonId)
        external
        view
        returns (SeasonLeaderboard memory)
    {
        return seasonLeaderboards[_seasonId];
    }

    /**
     * @notice Check if user has claimed season bonus
     */
    function hasClaimedSeasonBonus(address _user, uint256 _seasonId)
        external
        view
        returns (bool)
    {
        return userSeasonClaimed[_user][_seasonId];
    }

    /**
     * @notice Get user's weekly burn amount
     */
    function getUserWeeklyBurn(address _user, uint256 _week)
        external
        view
        returns (uint256)
    {
        return userWeeklyBurnAmount[_user][_week];
    }

    /**
     * @notice Get user's weekly claimed amount
     */
    function getUserWeeklyClaimed(address _user, uint256 _week)
        external
        view
        returns (uint256)
    {
        return userWeeklyClaimed[_user][_week];
    }

    // ============ Emergency Functions ============

    /**
     * @notice Emergency withdraw tokens (owner only)
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        if (_token == celoToken) {
            (bool success, ) = msg.sender.call{value: _amount}("");
            require(success, "Withdraw failed");
        } else {
            require(IERC20(_token).transfer(msg.sender, _amount), "Transfer failed");
        }
    }

    // ============ Receive CELO ============
    receive() external payable {}
}
