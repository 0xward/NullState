// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PassSBT
 * @notice Soulbound Token (SBT) for NullState Season Passes
 * @dev Non-transferable ERC721 tokens representing seasonal pass access
 * 
 * Features:
 * - 6 seasonal passes (1 per month, July-December 2026)
 * - Soulbound: non-transferable, non-tradeable
 * - Flexible whitelist for free FCFS distribution (50 per season)
 * - Paid minting at 0.3 USDm per pass
 * - Each season has fixed supply managed separately
 * - Owner can manage whitelist and season configurations
 * - Metadata hosted on Vercel with season-specific details
 */

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PassSBT is ERC721, Ownable {
    using Strings for uint256;

    // ============ Constants ============
    uint256 public constant TOTAL_SEASONS = 6;
    uint256 public constant PASS_PRICE = 3e17; // 0.3 USDm (18 decimals)
    string public constant BASE_URI = "https://nullstate-ten.vercel.app/assets/sbt-pass/metadata/";

    // ============ State Variables ============
    IERC20 public usdmToken = IERC20(0x765DE816845861e75A25fCA122bb6898B8B1282a);
    uint256 private _tokenIdCounter = 0;

    // Season configuration
    mapping(uint256 => uint256) public seasonSupply; // seasonId => max supply
    mapping(uint256 => uint256) public seasonMinted; // seasonId => minted count
    mapping(uint256 => uint256) public seasonStartDate; // seasonId => start timestamp
    mapping(uint256 => uint256) public seasonEndDate; // seasonId => end timestamp

    // Token mapping
    mapping(uint256 => uint256) public tokenSeasonId; // tokenId => seasonId
    mapping(address => uint256) public userPassSeason; // user => seasonId they hold pass for

    // Whitelist management
    mapping(uint256 => mapping(address => bool)) public whitelisted; // seasonId => user => is whitelisted
    mapping(uint256 => mapping(address => bool)) public whitelistClaimed; // seasonId => user => has claimed free pass
    mapping(uint256 => uint256) public whitelistCount; // seasonId => number of whitelisted addresses

    // ============ Events ============
    event PassMinted(address indexed user, uint256 seasonId, bool isFree);
    event WhitelistAdded(address indexed user, uint256 seasonId);
    event WhitelistRemoved(address indexed user, uint256 seasonId);
    event SeasonCreated(uint256 seasonId, uint256 startDate, uint256 endDate);

    // ============ Constructor ============
    constructor() ERC721("NullState Season Pass", "NULPASS") {}

    // ============ Season Management (Owner Only) ============

    /**
     * @notice Initialize a new season
     * @param _seasonId Season identifier (e.g., 202607 for July 2026)
     * @param _startDate Season start timestamp (UTC)
     * @param _endDate Season end timestamp (UTC)
     * @param _maxSupply Maximum passes available for this season
     */
    function initializeSeason(
        uint256 _seasonId,
        uint256 _startDate,
        uint256 _endDate,
        uint256 _maxSupply
    ) external onlyOwner {
        require(seasonStartDate[_seasonId] == 0, "Season already exists");
        require(_startDate < _endDate, "Invalid dates");
        require(_maxSupply > 0, "Supply must be > 0");

        seasonSupply[_seasonId] = _maxSupply;
        seasonStartDate[_seasonId] = _startDate;
        seasonEndDate[_seasonId] = _endDate;

        emit SeasonCreated(_seasonId, _startDate, _endDate);
    }

    // ============ Whitelist Management ============

    /**
     * @notice Add single address to whitelist for free pass
     */
    function addToWhitelist(address _user, uint256 _seasonId) external onlyOwner {
        require(seasonStartDate[_seasonId] != 0, "Season not initialized");
        require(!whitelisted[_seasonId][_user], "Already whitelisted");

        whitelisted[_seasonId][_user] = true;
        whitelistCount[_seasonId]++;

        emit WhitelistAdded(_user, _seasonId);
    }

    /**
     * @notice Remove address from whitelist
     */
    function removeFromWhitelist(address _user, uint256 _seasonId) external onlyOwner {
        require(whitelisted[_seasonId][_user], "Not whitelisted");

        whitelisted[_seasonId][_user] = false;
        whitelistCount[_seasonId]--;

        emit WhitelistRemoved(_user, _seasonId);
    }

    /**
     * @notice Batch add addresses to whitelist
     */
    function addBatchWhitelist(address[] calldata _users, uint256 _seasonId) external onlyOwner {
        require(seasonStartDate[_seasonId] != 0, "Season not initialized");

        for (uint256 i = 0; i < _users.length; i++) {
            if (!whitelisted[_seasonId][_users[i]]) {
                whitelisted[_seasonId][_users[i]] = true;
                whitelistCount[_seasonId]++;
                emit WhitelistAdded(_users[i], _seasonId);
            }
        }
    }

    /**
     * @notice Batch remove addresses from whitelist
     */
    function removeBatchWhitelist(address[] calldata _users, uint256 _seasonId) external onlyOwner {
        for (uint256 i = 0; i < _users.length; i++) {
            if (whitelisted[_seasonId][_users[i]]) {
                whitelisted[_seasonId][_users[i]] = false;
                whitelistCount[_seasonId]--;
                emit WhitelistRemoved(_users[i], _seasonId);
            }
        }
    }

    // ============ Pass Minting ============

    /**
     * @notice Mint free pass for whitelisted users (FCFS)
     */
    function mintFreePass(uint256 _seasonId) external {
        require(seasonStartDate[_seasonId] != 0, "Season not initialized");
        require(whitelisted[_seasonId][msg.sender], "Not whitelisted");
        require(!whitelistClaimed[_seasonId][msg.sender], "Free pass already claimed");
        require(seasonMinted[_seasonId] < seasonSupply[_seasonId], "Season sold out");
        require(userPassSeason[msg.sender] == 0, "Already have active pass");

        whitelistClaimed[_seasonId][msg.sender] = true;
        _mintPass(msg.sender, _seasonId, true);
    }

    /**
     * @notice Mint paid pass (0.3 USDm)
     */
    function mintPaidPass(uint256 _seasonId) external {
        require(seasonStartDate[_seasonId] != 0, "Season not initialized");
        require(seasonMinted[_seasonId] < seasonSupply[_seasonId], "Season sold out");
        require(userPassSeason[msg.sender] == 0, "Already have active pass");

        // Transfer USDm from user to owner
        require(
            usdmToken.transferFrom(msg.sender, owner(), PASS_PRICE),
            "Payment failed"
        );

        _mintPass(msg.sender, _seasonId, false);
    }

    /**
     * @notice Internal minting logic
     */
    function _mintPass(address _user, uint256 _seasonId, bool _isFree) internal {
        uint256 tokenId = ++_tokenIdCounter;
        tokenSeasonId[tokenId] = _seasonId;
        userPassSeason[_user] = _seasonId;
        seasonMinted[_seasonId]++;

        _safeMint(_user, tokenId);
        emit PassMinted(_user, _seasonId, _isFree);
    }

    // ============ SBT Logic (Non-Transferable) ============

    /**
     * @notice Override transfer to prevent token transfers (Soulbound)
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = ownerOf(tokenId);

        // Allow minting and burning, prevent transfers
        require(from == address(0) || to == address(0), "SBT: Non-transferable");

        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Prevent approval for transfers
     */
    function approve(address, uint256) public override {
        revert("SBT: Approve not allowed");
    }

    /**
     * @notice Prevent approval for all transfers
     */
    function setApprovalForAll(address, bool) public override {
        revert("SBT: Approve not allowed");
    }

    // ============ Metadata ============

    /**
     * @notice Return metadata URI for token
     */
    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(ownerOf(_tokenId) != address(0), "Token does not exist");
        uint256 seasonId = tokenSeasonId[_tokenId];
        return string(abi.encodePacked(BASE_URI, seasonId.toString(), ".json"));
    }

    // ============ Query Functions ============

    /**
     * @notice Check if user has pass for current season
     */
    function hasPass(address _user) external view returns (bool) {
        return userPassSeason[_user] != 0;
    }

    /**
     * @notice Get current pass season for user
     */
    function getUserPassSeason(address _user) external view returns (uint256) {
        return userPassSeason[_user];
    }

    /**
     * @notice Check if user is whitelisted for season
     */
    function isWhitelisted(address _user, uint256 _seasonId) external view returns (bool) {
        return whitelisted[_seasonId][_user];
    }

    /**
     * @notice Get season details
     */
    function getSeasonInfo(uint256 _seasonId)
        external
        view
        returns (
            uint256 supply,
            uint256 minted,
            uint256 startDate,
            uint256 endDate
        )
    {
        return (
            seasonSupply[_seasonId],
            seasonMinted[_seasonId],
            seasonStartDate[_seasonId],
            seasonEndDate[_seasonId]
        );
    }
}
