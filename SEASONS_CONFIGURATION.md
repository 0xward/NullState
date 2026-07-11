# NullState Season Configuration

## 📅 SEASONS (6 bulan, July - December 2026)

### **Season 1: July 2026** (202607)
- Start: `1719792000` (2026-07-01 00:00 UTC)
- End: `1722470399` (2026-07-31 23:59 UTC)
- Max Supply: 1000
- Top 1 Reward: 20 USDm
- Top 2 Reward: 5 USDm
- Top 3 Reward: 3 USDm
- Total Bonus Pool: 28 USDm

### **Season 2: August 2026** (202608)
- Start: `1722470400` (2026-08-01 00:00 UTC)
- End: `1725148799` (2026-08-31 23:59 UTC)
- Max Supply: 1000
- Total Bonus Pool: 28 USDm

### **Season 3: September 2026** (202609)
- Start: `1725148800` (2026-09-01 00:00 UTC)
- End: `1727740799` (2026-09-30 23:59 UTC)
- Max Supply: 1000
- Total Bonus Pool: 28 USDm

### **Season 4: October 2026** (202610)
- Start: `1727740800` (2026-10-01 00:00 UTC)
- End: `1730419199` (2026-10-31 23:59 UTC)
- Max Supply: 1000
- Total Bonus Pool: 28 USDm

### **Season 5: November 2026** (202611)
- Start: `1730419200` (2026-11-01 00:00 UTC)
- End: `1733011199` (2026-11-30 23:59 UTC)
- Max Supply: 1000
- Total Bonus Pool: 28 USDm

### **Season 6: December 2026** (202612)
- Start: `1733011200` (2026-12-01 00:00 UTC)
- End: `1735689599` (2026-12-31 23:59 UTC)
- Max Supply: 1000
- Total Bonus Pool: 28 USDm

---

## 🎮 CELOSCAN INSTRUCTIONS

### **Initialize All 6 Seasons**

Buka: https://celoscan.io/address/0x5235ffBb4C02fCabf29b76Aa0011DA3E1eD96f0e#writeContract

**Connect wallet:** 0x2A6b5204B83C7619c90c4EB6b5365AA0b7d912F7 (owner)

**For each season, call `initializeSeason` with:**

```
_seasonId: [season number from above]
_startDate: [start timestamp]
_endDate: [end timestamp]
_maxSupply: 1000
```

Then click "Write" and approve in MetaMask.

---

## 📋 QUICK REFERENCE

| Season | ID | Start Date | End Date | Timestamp Start | Timestamp End |
|--------|-----|-----------|----------|-----------------|---------------|
| July | 202607 | 2026-07-01 | 2026-07-31 | 1719792000 | 1722470399 |
| August | 202608 | 2026-08-01 | 2026-08-31 | 1722470400 | 1725148799 |
| **September** | **202609** | **2026-09-01** | **2026-09-30** | **1725148800** | **1727740799** |
| **October** | **202610** | **2026-10-01** | **2026-10-31** | **1727740800** | **1730419199** |
| November | 202611 | 2026-11-01 | 2026-11-30 | 1730419200 | 1733011199 |
| December | 202612 | 2026-12-01 | 2026-12-31 | 1733011200 | 1735689599 |

---

## ⏱️ TIMESTAMPS EXPLAINED

- **1725148800** = 2026-09-01 00:00:00 UTC
- **1727740799** = 2026-09-30 23:59:59 UTC
- **1727740800** = 2026-10-01 00:00:00 UTC
- **1730419199** = 2026-10-31 23:59:59 UTC

---

## 🛠️ UNTUK SEPTEMBER (202609):

**Di Celoscan, call `initializeSeason` dengan:**
```
_seasonId: 202609
_startDate: 1725148800
_endDate: 1727740799
_maxSupply: 1000
```

---

## 🛠️ UNTUK OCTOBER (202610):

**Di Celoscan, call `initializeSeason` dengan:**
```
_seasonId: 202610
_startDate: 1727740800
_endDate: 1730419199
_maxSupply: 1000
```
