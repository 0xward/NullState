# Panduan Deploy PassSBTv3 + NullStateRewardV2 + TreasureVaultV2

Panduan ini untuk dikerjakan dari HP via Remix (remix.ethereum.org) + Celoscan,
sama seperti pola yang sudah pernah dipakai untuk PassSBTv2. Ikuti URUTAN di
bawah — urutan ini PENTING karena NullStateRewardV2 butuh alamat PassSBTv3
yang sudah jadi sebagai constructor argument.

Wallet yang dipakai untuk deploy (jadi owner otomatis semua kontrak, karena
`Ownable(msg.sender)`): **`0x2A6b5204B83C7619c90c4EB6b5365AA0b7d912F7`**

Treasury & backend signer (Opsi A, sudah dipilih): **`0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6`**

## Setting compiler (WAJIB sama persis di ketiga kontrak)
- Compiler: **0.8.20+commit.a1b79de6** (versi release resmi yang sama dipakai
  PassSBTv2 — jangan biarkan npm/Remix resolve ke versi nightly seperti yang
  pernah gagal verify sebelumnya)
- Optimizer: **Enabled**, runs = **200**
- EVM version: default (jangan diubah)

## Urutan Deploy

### 1. PassSBTv3.sol
- Constructor: **tidak ada argumen** (`constructor()`)
- Setelah deploy, catat alamatnya — dipakai sebagai constructor arg
  NullStateRewardV2 di langkah berikutnya.
- Verifikasi di Celoscan: constructor args KOSONG (encoded ABI-nya string kosong).

### 2. NullStateRewardV2.sol
- Constructor: **`address _passSBT`** → isi dengan alamat PassSBTv3 dari langkah 1.
- Verifikasi di Celoscan: constructor arg = alamat PassSBTv3 (Celoscan akan
  otomatis encode dari field alamat yang kamu isi, tidak perlu encode manual).

### 3. TreasureVaultV2.sol
- Constructor: **tidak ada argumen** (`constructor()`)
- Verifikasi di Celoscan: constructor args KOSONG.

## Setelah Ketiga Kontrak Live & Terverifikasi

Panggil fungsi-fungsi berikut dari Celoscan "Write Contract" tab (connect
wallet `0x2A6b5204...` sebagai owner):

### Di PassSBTv3:
1. `setBackendAddress("0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6", true)`
2. `initializeSeason` x6, dengan nilai berikut (dari `SEASONS_CONFIGURATION.md`,
   sudah dikoreksi ke 2026 — JANGAN pakai nilai lama manapun yang menyebut 2024):

   | seasonId | startDate    | endDate      | maxSupply |
   |----------|--------------|--------------|-----------|
   | 202607   | 1782864000   | 1785542399   | 1000      |
   | 202608   | 1785542400   | 1788220799   | 1000      |
   | 202609   | 1788220800   | 1790812799   | 1000      |
   | 202610   | 1790812800   | 1793491199   | 1000      |
   | 202611   | 1793491200   | 1796083199   | 1000      |
   | 202612   | 1796083200   | 1798761599   | 1000      |

3. (Opsional) `setPassPriceUsdCents(30)` — 30 = default $0.30, sama seperti
   sekarang. Cuma perlu dipanggil kalau mau UBAH harga; kalau tidak, biarkan
   default-nya (constructor sudah set 30 otomatis).

### Di NullStateRewardV2:
1. `setBackendAddress("0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6", true)`
2. (Opsional) `setRankRewards(20000000000000000000, 5000000000000000000, 3000000000000000000)`
   — ini cuma perlu dipanggil kalau mau UBAH nilai dari default (20/5/3 USDm,
   sudah otomatis di-set di constructor lewat nilai awal variable).
3. (Opsional) `setWeeklyPoolSize(...)` / `setMaxPerUserPerWeek(...)` — sama,
   cuma kalau mau ubah dari default 2 USDm / 0.5 USDm.
4. `depositWeeklyPool(...)` dan `depositSeasonBonus(...)` seperti biasa untuk
   isi pool reward (perlu `approve()` token dulu ke alamat kontrak ini,
   sama seperti proses lama).

### Di TreasureVaultV2:
1. `setBackendAddress("0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6", true)`
2. (Opsional) `setVaultReward(...)` — cuma kalau mau ubah dari default 1 USDm.
3. `depositVaultPool(...)` untuk isi pool reward vault (approve dulu kalau
   pakai token ERC20).

## Sinkronisasi Kode Aplikasi (setelah semua di atas selesai)

Setelah tiga alamat kontrak baru dikirim balik, sesi berikutnya akan:
1. Update `NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS`,
   `NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS`, `NEXT_PUBLIC_TREASURE_VAULT_ADDRESS`
   di Vercel ke alamat baru.
2. Update `lib/contract-abi.ts` — tambah alamat lama ke
   `RETIRED_PASS_SBT_ADDRESSES` (pola yang sama dipakai untuk retired v1/v2
   attempt), dan sinkronkan ABI penuh untuk fungsi-fungsi baru
   (`setPassPriceUsdCents`, `setRankRewards`, `setVaultReward`, token
   setters) kalau nanti ada admin script yang butuh.
3. Playtest end-to-end: mint pass (paid & free), claim weekly burn reward,
   claim season bonus (harus gagal kalau tidak punya pass season itu, harus
   sukses kalau punya), submit vault code.

## Catatan Verifikasi Celoscan
- Struktur kode di ketiga kontrak baru ini SENGAJA dibuat mirror 1:1 dari
  kontrak lama (cuma nambah state variable + setter + fix bug, tidak ada
  helper/library baru) — supaya proses verify & flatten-nya predictable,
  sama seperti pengalaman sukses verify PassSBTv2 sebelumnya.
- Import OpenZeppelin yang dipakai sama persis dengan sebelumnya:
  `@openzeppelin/contracts/token/ERC721/ERC721.sol`,
  `@openzeppelin/contracts/access/Ownable.sol`,
  `@openzeppelin/contracts/utils/Strings.sol`.
