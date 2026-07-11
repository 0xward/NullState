// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract NullState {

    // -----------------------------------------
    // CONSTANTS
    // -----------------------------------------

    uint256 public constant ACTION_COST       = 0.01 ether; // 0.01 CELO
    uint256 public constant RAID_COST         = 0.01 ether; // 0.01 CELO
    uint64  public constant PASSPORT_XP_BONUS = 20;
    uint256 public constant XP_PER_LEVEL      = 200;
    uint256 public constant MAX_LEVEL         = 50;
    uint32  public constant RAID_TWEET_DAMAGE = 25;

    uint8 public constant ACTION_ATTACK   = 1;
    uint8 public constant ACTION_DEFEND   = 2;
    uint8 public constant ACTION_INSPECT  = 3;
    uint8 public constant ACTION_FLEE     = 4;
    uint8 public constant ACTION_ARTIFACT = 5;

    uint8 public constant RARITY_COMMON    = 1;
    uint8 public constant RARITY_RARE      = 2;
    uint8 public constant RARITY_EPIC      = 3;
    uint8 public constant RARITY_LEGENDARY = 4;

    // -----------------------------------------
    // STORAGE
    // -----------------------------------------

    address public owner;
    address public passportOracle;
    bool    public paused;

    struct Player {
        bool    exists;
        uint32  hp;
        uint32  maxHp;
        uint64  xp;
        uint16  level;
        uint32  kills;
        uint32  deaths;
        uint32  raidDamage;
        uint64  lastActionAt;
        bool    passportVerified;
    }

    struct PlayerView {
        bool    exists;
        uint32  hp;
        uint32  maxHp;
        uint64  xp;
        uint16  level;
        uint32  kills;
        uint32  deaths;
        bool    passportVerified;
        uint32  artifactCount_;
    }

    struct Artifact {
        uint32 id;
        uint8  artifactType;
        uint8  rarity;
        uint16 power;
        bool   onChain;
        bool   exists;
    }

    struct RaidBoss {
        uint64  id;
        uint64  maxHp;
        uint64  currentHp;
        uint8   phase;
        uint32  attackerCount;
        uint32  tweetCount;
        uint64  endsAt;
        bool    active;
        address topAttacker;
        uint32  topDamage;
    }

    struct CombatLog {
        address player;
        uint8   actionType;
        uint32  damageDealt;
        uint32  damageReceived;
        uint64  xpGained;
        uint64  timestamp;
    }

    mapping(address => Player)                     public  players;
    mapping(address => Artifact[])                 private playerArtifacts;
    mapping(address => uint32)                     public  artifactCount;
    mapping(uint64  => RaidBoss)                   public  raidBosses;
    mapping(uint64  => mapping(address => uint32)) public  raidContributions;
    mapping(address => uint64)                     public  lastRaidId;
    mapping(address => bool)                       public  tweetAttackedThisRaid;

    uint64  public currentRaidId;
    uint64  public totalRaids;
    uint64  public nextArtifactId;
    uint256 public treasuryBalance;
    CombatLog[] public combatHistory;

    // -----------------------------------------
    // EVENTS
    // -----------------------------------------

    event PlayerRegistered(address indexed player, uint64 timestamp);
    event ActionExecuted(address indexed player, uint8 actionType, uint32 damage, uint64 xpGained);
    event PlayerLevelUp(address indexed player, uint16 newLevel);
    event PlayerDied(address indexed player, uint32 kills, uint64 timestamp);
    event ArtifactDropped(address indexed player, uint32 artifactId, uint8 rarity, uint16 power);
    event RaidBossSpawned(uint64 indexed raidId, uint64 maxHp, uint64 endsAt);
    event RaidAttack(uint64 indexed raidId, address indexed attacker, uint32 damage);
    event RaidTweetAttack(uint64 indexed raidId, address indexed attacker, uint32 bonusDamage);
    event RaidBossDefeated(uint64 indexed raidId, address indexed topAttacker, uint256 reward);
    event PassportVerified(address indexed player);
    event TreasuryWithdraw(address indexed to, uint256 amount);

    // -----------------------------------------
    // MODIFIERS
    // -----------------------------------------

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "Game paused");
        _;
    }

    modifier playerExists() {
        require(players[msg.sender].exists, "Player not registered");
        _;
    }

    modifier playerAlive() {
        require(players[msg.sender].hp > 0, "Player is dead - respawn first");
        _;
    }

    modifier raidActive() {
        require(currentRaidId > 0, "No active raid");
        require(raidBosses[currentRaidId].active, "Raid not active");
        require(block.timestamp < raidBosses[currentRaidId].endsAt, "Raid expired");
        require(raidBosses[currentRaidId].currentHp > 0, "Boss already dead");
        _;
    }

    // -----------------------------------------
    // CONSTRUCTOR
    // -----------------------------------------

    constructor(address _passportOracle) {
        owner          = msg.sender;
        passportOracle = _passportOracle;
        nextArtifactId = 1;
    }

    // Allow contract to receive CELO
    receive() external payable {}

    // -----------------------------------------
    // REGISTRATION
    // -----------------------------------------

    function register() external notPaused {
        require(!players[msg.sender].exists, "Already registered");

        players[msg.sender] = Player({
            exists:           true,
            hp:               100,
            maxHp:            100,
            xp:               0,
            level:            1,
            kills:            0,
            deaths:           0,
            raidDamage:       0,
            lastActionAt:     uint64(block.timestamp),
            passportVerified: false
        });

        emit PlayerRegistered(msg.sender, uint64(block.timestamp));
    }

    function verifyPassport() external notPaused playerExists {
        require(!players[msg.sender].passportVerified, "Already verified");
        players[msg.sender].passportVerified = true;
        players[msg.sender].xp += PASSPORT_XP_BONUS;
        _checkLevelUp(msg.sender);
        emit PassportVerified(msg.sender);
    }

    // -----------------------------------------
    // CORE COMBAT
    // -----------------------------------------

    function executeAction(
        uint8  actionType,
        uint32 damageDealt,
        uint32 damageReceived,
        uint64 xpGained,
        bool   enemyKilled
    )
        external
        payable
        notPaused
        playerExists
        playerAlive
    {
        require(msg.value == ACTION_COST, "Send exactly 0.01 CELO");
        require(actionType >= 1 && actionType <= 5, "Invalid action");
        require(damageDealt    <= 150, "Damage out of range");
        require(damageReceived <= 100, "Damage out of range");
        require(xpGained       <= 200, "XP out of range");

        Player storage p = players[msg.sender];
        require(block.timestamp >= p.lastActionAt + 2, "Too fast");

        treasuryBalance += msg.value;

        p.lastActionAt = uint64(block.timestamp);

        if (damageReceived > 0) {
            if (damageReceived >= p.hp) {
                p.hp = 0;
            } else {
                p.hp -= damageReceived;
            }
        }

        if (p.hp > 0) {
            uint64 bonus = p.passportVerified ? (xpGained * PASSPORT_XP_BONUS) / 100 : 0;
            p.xp += xpGained + bonus;
            _checkLevelUp(msg.sender);
        }

        if (enemyKilled && p.hp > 0) {
            p.kills++;
            _rollLoot(msg.sender, p.level);
        }

        combatHistory.push(CombatLog({
            player:         msg.sender,
            actionType:     actionType,
            damageDealt:    damageDealt,
            damageReceived: damageReceived,
            xpGained:       xpGained,
            timestamp:      uint64(block.timestamp)
        }));

        emit ActionExecuted(msg.sender, actionType, damageDealt, xpGained);

        if (p.hp == 0) {
            _handleDeath(msg.sender);
        }
    }

    function respawn() external notPaused playerExists {
        Player storage p = players[msg.sender];
        require(p.hp == 0, "Not dead");

        p.hp    = p.maxHp;
        p.level = 1;
        p.xp    = 0;

        delete playerArtifacts[msg.sender];
        artifactCount[msg.sender] = 0;
    }

    // -----------------------------------------
    // RAID BOSS
    // -----------------------------------------

    function spawnRaidBoss(uint64 maxHp, uint64 durationSeconds) external onlyOwner {
        if (currentRaidId > 0) {
            raidBosses[currentRaidId].active = false;
        }

        totalRaids++;
        currentRaidId = totalRaids;

        raidBosses[currentRaidId] = RaidBoss({
            id:            currentRaidId,
            maxHp:         maxHp,
            currentHp:     maxHp,
            phase:         1,
            attackerCount: 0,
            tweetCount:    0,
            endsAt:        uint64(block.timestamp) + durationSeconds,
            active:        true,
            topAttacker:   address(0),
            topDamage:     0
        });

        emit RaidBossSpawned(currentRaidId, maxHp, uint64(block.timestamp) + durationSeconds);
    }

    function attackRaidBoss(uint32 damage)
        external
        payable
        notPaused
        playerExists
        playerAlive
        raidActive
    {
        require(msg.value == RAID_COST, "Send exactly 0.01 CELO");
        require(damage > 0 && damage <= 200, "Invalid damage");

        treasuryBalance += msg.value;

        RaidBoss storage boss = raidBosses[currentRaidId];

        if (raidContributions[currentRaidId][msg.sender] == 0) {
            boss.attackerCount++;
        }

        uint32 actualDamage = damage;
        if (actualDamage > boss.currentHp) {
            actualDamage = uint32(boss.currentHp);
        }

        boss.currentHp                               -= actualDamage;
        raidContributions[currentRaidId][msg.sender] += actualDamage;
        players[msg.sender].raidDamage               += actualDamage;
        lastRaidId[msg.sender]                        = currentRaidId;

        _updatePhase(boss);
        _updateTopAttacker(boss, msg.sender);

        emit RaidAttack(currentRaidId, msg.sender, actualDamage);

        if (boss.currentHp == 0) {
            _defeatRaidBoss();
        }
    }

    function registerTweetAttack(address attacker)
        external
        notPaused
        raidActive
    {
        require(
            msg.sender == owner || msg.sender == attacker,
            "Unauthorized"
        );
        require(!tweetAttackedThisRaid[attacker], "Already tweeted this raid");
        require(players[attacker].exists, "Player not registered");

        tweetAttackedThisRaid[attacker] = true;

        RaidBoss storage boss = raidBosses[currentRaidId];
        boss.tweetCount++;

        uint32 bonusDamage = RAID_TWEET_DAMAGE;
        if (bonusDamage > boss.currentHp) {
            bonusDamage = uint32(boss.currentHp);
        }

        boss.currentHp                             -= bonusDamage;
        raidContributions[currentRaidId][attacker] += bonusDamage;
        players[attacker].raidDamage               += bonusDamage;

        _updateTopAttacker(boss, attacker);

        emit RaidTweetAttack(currentRaidId, attacker, bonusDamage);

        if (boss.currentHp == 0) {
            _defeatRaidBoss();
        }
    }

    // -----------------------------------------
    // INTERNAL LOGIC
    // -----------------------------------------

    function _handleDeath(address playerAddr) internal {
        players[playerAddr].deaths++;
        emit PlayerDied(playerAddr, players[playerAddr].kills, uint64(block.timestamp));
    }

    function _checkLevelUp(address playerAddr) internal {
        Player storage p = players[playerAddr];
        uint16 newLevel  = uint16(p.xp / XP_PER_LEVEL) + 1;
        if (newLevel > MAX_LEVEL) newLevel = uint16(MAX_LEVEL);

        if (newLevel > p.level) {
            p.level = newLevel;
            p.maxHp = uint32(100 + uint256(newLevel - 1) * 10);
            if (p.hp > p.maxHp) p.hp = p.maxHp;
            emit PlayerLevelUp(playerAddr, newLevel);
        }
    }

    function _rollLoot(address playerAddr, uint16 level) internal {
        uint256 seed = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            playerAddr,
            nextArtifactId
        )));

        uint256 roll = seed % 100;

        uint8 rarity;
        if      (roll < 50) rarity = RARITY_COMMON;
        else if (roll < 78) rarity = RARITY_RARE;
        else if (roll < 93) rarity = RARITY_EPIC;
        else                rarity = RARITY_LEGENDARY;

        if (level >= 5)  { if (rarity == RARITY_COMMON && roll >= 45) rarity = RARITY_RARE; }
        if (level >= 10) { if (rarity == RARITY_RARE   && roll >= 75) rarity = RARITY_EPIC; }

        uint16 power       = uint16(10 + (seed % 40) + uint256(rarity) * 10 + uint256(level) / 2);
        uint8 artifactType = uint8((seed >> 8) % 5) + 1;

        Artifact memory a = Artifact({
            id:           uint32(nextArtifactId),
            artifactType: artifactType,
            rarity:       rarity,
            power:        power,
            onChain:      true,
            exists:       true
        });

        playerArtifacts[playerAddr].push(a);
        artifactCount[playerAddr]++;
        nextArtifactId++;

        emit ArtifactDropped(playerAddr, a.id, rarity, power);
    }

    function _updatePhase(RaidBoss storage boss) internal {
        uint64 hpPercent = (boss.currentHp * 100) / boss.maxHp;
        if      (hpPercent <= 33) boss.phase = 3;
        else if (hpPercent <= 66) boss.phase = 2;
        else                      boss.phase = 1;
    }

    function _updateTopAttacker(RaidBoss storage boss, address attacker) internal {
        uint32 contrib = raidContributions[currentRaidId][attacker];
        if (contrib > boss.topDamage) {
            boss.topDamage   = contrib;
            boss.topAttacker = attacker;
        }
    }

    function _defeatRaidBoss() internal {
        RaidBoss storage boss = raidBosses[currentRaidId];
        boss.active = false;

        uint256 reward = (treasuryBalance * 10) / 100;
        if (reward > 1 ether) reward = 1 ether;

        address winner = boss.topAttacker;

        if (winner != address(0) && reward > 0 && treasuryBalance >= reward) {
            treasuryBalance -= reward;
            (bool sent, ) = payable(winner).call{value: reward}("");
            require(sent, "Reward transfer failed");
        }

        emit RaidBossDefeated(currentRaidId, winner, reward);
    }

    // -----------------------------------------
    // VIEW FUNCTIONS
    // -----------------------------------------

    function getPlayer(address addr)
        external view
        returns (PlayerView memory)
    {
        Player storage p = players[addr];
        return PlayerView({
            exists:           p.exists,
            hp:               p.hp,
            maxHp:            p.maxHp,
            xp:               p.xp,
            level:            p.level,
            kills:            p.kills,
            deaths:           p.deaths,
            passportVerified: p.passportVerified,
            artifactCount_:   artifactCount[addr]
        });
    }

    function getArtifacts(address addr)
        external view
        returns (Artifact[] memory)
    {
        return playerArtifacts[addr];
    }

    function getCurrentRaid()
        external view
        returns (
            uint64  id,
            uint64  currentHp,
            uint64  maxHp,
            uint8   phase,
            uint32  attackers,
            uint32  tweets,
            uint64  endsAt,
            bool    active,
            address topAttacker,
            uint32  topDamage
        )
    {
        if (currentRaidId == 0) {
            return (0, 0, 0, 0, 0, 0, 0, false, address(0), 0);
        }
        RaidBoss storage boss = raidBosses[currentRaidId];
        return (
            boss.id,
            boss.currentHp,
            boss.maxHp,
            boss.phase,
            boss.attackerCount,
            boss.tweetCount,
            boss.endsAt,
            boss.active && block.timestamp < boss.endsAt && boss.currentHp > 0,
            boss.topAttacker,
            boss.topDamage
        );
    }

    function getMyRaidContribution() external view returns (uint32) {
        if (currentRaidId == 0) return 0;
        return raidContributions[currentRaidId][msg.sender];
    }

    function getCombatHistoryLength() external view returns (uint256) {
        return combatHistory.length;
    }

    function getCombatHistory(uint256 from, uint256 count)
        external view
        returns (CombatLog[] memory)
    {
        uint256 total = combatHistory.length;
        if (from >= total) return new CombatLog[](0);
        uint256 end = from + count;
        if (end > total) end = total;
        CombatLog[] memory result = new CombatLog[](end - from);
        for (uint256 i = from; i < end; i++) {
            result[i - from] = combatHistory[i];
        }
        return result;
    }

    // -----------------------------------------
    // OWNER FUNCTIONS
    // -----------------------------------------

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    function setPassportOracle(address _oracle) external onlyOwner {
        passportOracle = _oracle;
    }

    function withdrawTreasury(address to, uint256 amount) external onlyOwner {
        require(amount <= treasuryBalance, "Exceeds treasury");
        require(amount <= address(this).balance, "Insufficient contract balance");
        treasuryBalance -= amount;
        (bool sent, ) = payable(to).call{value: amount}("");
        require(sent, "Transfer failed");
        emit TreasuryWithdraw(to, amount);
    }

    function forceEndRaid() external onlyOwner {
        require(currentRaidId > 0, "No raid");
        raidBosses[currentRaidId].active = false;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
