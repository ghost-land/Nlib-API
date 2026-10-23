# Nlib API

A modern and performant REST API for Nintendo game library data. Access game information, media assets, screenshots, and comprehensive statistics across Nintendo platforms.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://opensource.org/licenses/GPL-3.0)
[![API Status](https://img.shields.io/badge/status-online-success.svg)](https://api.nlib.cc/uptime)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.10-brightgreen.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-%3E%3D12-316192.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Version](https://img.shields.io/badge/version-3.1.0-blue.svg)](https://github.com/ghost-land/Nlib-API)

[![GitHub Stars](https://img.shields.io/github/stars/ghost-land/Nlib-API?style=flat)](https://github.com/ghost-land/Nlib-API/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/ghost-land/Nlib-API?style=flat)](https://github.com/ghost-land/Nlib-API/issues)
[![Last Commit](https://img.shields.io/github/last-commit/ghost-land/Nlib-API?style=flat)](https://github.com/ghost-land/Nlib-API/commits)

## Features

- 🎮 Complete Nintendo Switch game database
- 🎮 Complete Nintendo 3DS game database
- 🖼️ Game icons, banners, and screenshots
- 🌍 Multi-language support (11 languages for Switch)
- 📊 Comprehensive statistics
- 🔄 Automatic synchronization (Switch TitleDB + 3DS metadata, serialized)
- 🚀 Fast and lightweight

## API Documentation

### Base URL

The API is accessible at your deployment URL. All endpoints support trailing slashes.

### Nintendo Switch Endpoints (`/nx`)

#### Get Game Information

```http
GET /nx/:tid?lang=en
```

**Parameters:**
- `tid` (required) - 16-character hexadecimal Title ID
- `lang` (optional) - Language code, default: `en`
  - Available: `en`, `ja`, `es`, `de`, `fr`, `nl`, `pt`, `it`, `zh`, `ko`, `ru`
- `fields` (optional) - Comma-separated list of fields to include. Always includes `id`.
  - Example: `name,description,publisher`

**Example Requests:**
```http
# Full response
GET /nx/01007EF00011E000?lang=fr

# Only specific fields
GET /nx/01007EF00011E000?fields=name,description
GET /nx/01007EF00011E000?fields=description
GET /nx/01007EF00011E000?fields=name,publisher,releaseDate,icon

# Combine parameters
GET /nx/01007EF00011E000?lang=fr&fields=name,description,intro
```

**Example Response:**
```json
{
  "description": "Full game description...",
  "id": "01007EF00011E000",
  "name": "The Legend of Zelda™: Breath of the Wild",
  "publisher": "Nintendo",
  "releaseDate": "2017-03-03",
  "version": 196608,
  "category": ["Adventure", "Action", "RPG"],
  "developer": "Nintendo EPD",
  "intro": "Short introduction...",
  "isDemo": false,
  "languages": ["ja", "en", "es", "fr", "de", "it", "nl", "ru", "ko", "zh"],
  "nsuId": 70010000000025,
  "numberOfPlayers": 1,
  "ratingContent": ["Fantasy Violence", "Mild Suggestive Themes"],
  "region": "US",
  "rightsId": "01007EF00011E0000000000000000000",
  "console": "nx",
  "type": "base",
  "icon": "https://api.nlib.cc/nx/01007EF00011E000/icon",
  "banner": "https://api.nlib.cc/nx/01007EF00011E000/banner",
  "screens": {
    "count": 8,
    "screenshots": [
      "https://api.nlib.cc/nx/01007EF00011E000/screen/1",
      "https://api.nlib.cc/nx/01007EF00011E000/screen/2",
      "https://api.nlib.cc/nx/01007EF00011E000/screen/3"
    ]
  }
}
```

**Example Filtered Response:**
```http
GET /nx/01007EF00011E000?fields=name,description
```

```json
{
  "id": "01007EF00011E000",
  "name": "The Legend of Zelda™: Breath of the Wild",
  "description": "Full game description..."
}
```

**Notes:**
- Media URLs (`icon`, `banner`, `screens`) are only included if the corresponding media files are available
- Use the `fields` parameter to request only specific data and reduce response size
- The `id` field is always included in the response
- SQL queries are optimized to select only requested fields
- Media checks (filesystem operations) are skipped if not requested

**Performance Benefits:**

| Request | Response Size | SQL Complexity | Media Checks |
|---------|---------------|----------------|--------------|
| Full response | 2-5 KB | All fields + JOIN | 3 file checks |
| `?fields=name,publisher` | ~100 bytes | 2 fields only | None |
| `?fields=description` | ~1-3 KB | 1 field + JOIN | None |
| `?fields=name,icon` | ~200 bytes | 1 field only | Icon only |

**Example optimization:**
```http
# Before: Full response (2.5 KB, 15ms)
GET /nx/01007EF00011E000

# After: Only what you need (150 bytes, 3ms)
GET /nx/01007EF00011E000?fields=name,publisher
```

#### Get Game Icon

```http
GET /nx/:tid/icon/:width?/:height?
```

**Parameters:**
- `width` (optional) - Size in pixels (30-4096). Automatically rounded to nearest 10.
- `height` (optional) - Must equal width if provided. Icons are always square.

Returns the game icon in JPEG format. If no size is specified, returns the original image.

**Examples:**
```http
GET /nx/01007EF00011E000/icon              # Original size
GET /nx/01007EF00011E000/icon/32           # 30x30 (rounded)
GET /nx/01007EF00011E000/icon/64           # 60x60 (rounded)
GET /nx/01007EF00011E000/icon/256          # 260x260 (rounded)
GET /nx/01007EF00011E000/icon/256/256      # 260x260 (explicit)
GET /nx/01007EF00011E000/icon/512/512      # 510x510 (rounded)
GET /nx/01007EF00011E000/icon/1024         # 1020x1020 (rounded)
```

**Notes:**
- Icons are always square
- Sizes are automatically rounded to the nearest 10 pixels for cache optimization
- Minimum size: 30 pixels
- Both `/icon/256` and `/icon/256/256` produce identical results
- Response header `X-Size-Rounded` shows the actual size served (e.g., `64->60`)

#### Get Game Banner

```http
GET /nx/:tid/banner/:size?
GET /nx/:tid/banner/:width/:height
```

**Parameters:**
- `size` (optional) - Banner size shorthand
  - Shortcuts: `240`/`240p`, `360`/`360p`, `480`/`480p`, `540`/`540p`, `720`/`720p`, `1080`/`1080p`
  - Widths: `426`, `640`, `854`, `960`, `1280`, `1920`
  - Default: 1920x1080 (1080p)
- `width` (optional) - Custom width in pixels (100-1920)
- `height` (optional) - Custom height in pixels (100-1080)

Returns the game banner in JPEG format.

**Examples (Shortcuts):**
```http
GET /nx/01007EF00011E000/banner         # 1920x1080 (default)
GET /nx/01007EF00011E000/banner/1080p   # 1920x1080
GET /nx/01007EF00011E000/banner/720p    # 1280x720
GET /nx/01007EF00011E000/banner/540p    # 960x540
GET /nx/01007EF00011E000/banner/480p    # 854x480
GET /nx/01007EF00011E000/banner/360p    # 640x360
GET /nx/01007EF00011E000/banner/240p    # 426x240
GET /nx/01007EF00011E000/banner/1920    # 1920x1080
GET /nx/01007EF00011E000/banner/426     # 426x240
```

**Examples (Custom dimensions):**
```http
GET /nx/01007EF00011E000/banner/1280/720   # Custom 1280x720
GET /nx/01007EF00011E000/banner/1920/1080  # Custom 1920x1080
GET /nx/01007EF00011E000/banner/800/450    # Custom 800x450
GET /nx/01007EF00011E000/banner/640/360    # Custom 640x360
```

#### Get Screenshot

```http
GET /nx/:tid/screen/:index
```

**Parameters:**
- `index` (required) - Screenshot index (starts at 1)

Returns a specific screenshot in JPEG format.

#### Get All Screenshots

```http
GET /nx/:tid/screens
```

**Example Response:**
```json
{
  "count": 8,
  "screenshots": [
    "https://api.nlib.cc/nx/0100ABC001234000/screen/1",
    "https://api.nlib.cc/nx/0100ABC001234000/screen/2",
    "https://api.nlib.cc/nx/0100ABC001234000/screen/3"
  ]
}
```

Note: Screenshot URLs are dynamically generated based on the API domain.

#### Get Statistics

```http
GET /nx/stats
```

### Nintendo 3DS Endpoints (`/ctr`)

#### Get Statistics

```http
GET /ctr/stats
```

**Example Response:**
```json
{
  "total": 8769,
  "categories": {
    "base": 5339,
    "digital-demos": 120,
    "kiosk-demos": 45,
    "region-free": 12,
    "unknown-other": 8,
    "dlc": 351,
    "dsiware": 1599,
    "extras": 0,
    "extras/hb": 41,
    "extras/rom-hacks": 10,
    "updates": 556,
    "videos": 234,
    "virtual-console": 690,
    "themes": 0
  }
}
```

#### Get Category Titles

```http
GET /ctr/category/:category
```

**Parameters:**
- `category` (required) - Category name
  - Top-level: `base`, `digital-demos`, `kiosk-demos`, `region-free`, `unknown-other`, `dlc`, `dsiware`, `extras`, `updates`, `videos`, `virtual-console`, `themes`
  - Nested extras: `extras/hb`, `extras/rom-hacks`, `extras/devapps-misc`, `extras/custom-dsiware`, `extras/translated-games`
  - `extras` returns all titles under `extras` and `extras/*`

**Example Response:**
```json
{
  "category": "base",
  "count": 5339,
  "titles": [
    "0004000000030000",
    "0004000000030100",
    "0004000000030200"
  ]
}
```

#### Get Game Information

```http
GET /ctr/:tid?fields=name,description,publisher,region
```

**Parameters:**
- `tid` (required) - 16-character hexadecimal Title ID
- `fields` (optional) - Comma-separated list of fields to include

**Example Response:**
```json
{
  "tid": "0004000000030000",
  "uid": "50010000009504",
  "name": "新･光神話 パルテナの鏡",
  "formal_name": "新･光神話 パルテナの鏡",
  "description": "冥府軍と、飛べない天使ピットの壮大な戦いを描いたシングルプレイ。",
  "release_date_on_eshop": "2013-10-31",
  "product_code": "CTR-N-AKDJ",
  "platform_name": "3DSカード/ダウンロードソフト",
  "region": "JP",
  "genres": ["アクション", "シューティング"],
  "features": ["インターネット対応", "3D映像対応"],
  "languages": ["ja"],
  "rating_system": {"name": "CERO", "age": "12"},
  "version": "v0.2.0",
  "disclaimer": null,
  "descriptors": [],
  "publisher": "Nintendo",
  "smdh": {"flags": ["Allow3D", "SaveData"]},
  "category": "base",
  "media": {
    "banner": "https://api.nlib.cc/ctr/0004000000030000/banner",
    "icon": "https://api.nlib.cc/ctr/0004000000030000/icon",
    "screenshots": {
      "compiled": ["https://api.nlib.cc/ctr/0004000000030000/screen/1"],
      "uncompiled": {
        "upper": ["https://api.nlib.cc/ctr/0004000000030000/screen_u/1/u"],
        "lower": ["https://api.nlib.cc/ctr/0004000000030000/screen_u/1/l"]
      }
    },
    "thumbnails": ["https://api.nlib.cc/ctr/0004000000030000/thumb/1"]
  }
}
```

**Notes:**
- `region` uses uppercase ISO / market codes (`JP`, `US`, `EU`, `FR`, `DE`, `GB`, `FREE`, …)
- Languages use ISO-639 codes (`ja`, `en`, …)

#### Get Specific Metadata Field

```http
GET /ctr/:tid/meta/:meta
```

**Parameters:**
- `tid` (required) - 16-character hexadecimal Title ID
- `meta` (required) - Field name (e.g. `name`, `publisher`, `region`, `category`, `smdh`, `release_date_on_eshop`)

#### Get Media Assets

```http
GET /ctr/:tid/media          # All media URLs
GET /ctr/:tid/icon           # Icon image
GET /ctr/:tid/banner         # Banner image
GET /ctr/:tid/screens        # List compiled screenshots
GET /ctr/:tid/screen/:num    # Compiled screenshot
GET /ctr/:tid/screen_u       # List uncompiled screenshots
GET /ctr/:tid/screen_u/:num/:screen  # Uncompiled screenshot (u/l)
GET /ctr/:tid/thumbs         # List thumbnails
GET /ctr/:tid/thumb/:num     # Thumbnail image
```

**Notes:**
- All images are served in JPEG format
- Uncompiled screenshots use `u` for upper screen and `l` for lower screen
- Media files are stored in `media/ctr/[category]/[tid]/` (category may be nested, e.g. `extras/hb`)

### System Endpoints

#### Uptime Status

```http
GET /uptime
```

Returns server status and uptime information.

## Database Schema

### nx

Main table storing game information.

| Column | Type | Description |
|--------|------|-------------|
| tid | VARCHAR(16) | Title ID (Primary Key) |
| name | TEXT | Game name |
| publisher | TEXT | Publisher name |
| developer | TEXT | Developer name |
| release_date | VARCHAR(10) | Release date (YYYY-MM-DD) |
| category | TEXT | Categories (JSON array) |
| languages | TEXT | Supported languages (JSON array) |
| nsu_id | BIGINT | Nintendo eShop ID |
| number_of_players | INTEGER | Number of players |
| rating_content | TEXT | Rating content (JSON array) |
| rights_id | VARCHAR(32) | Rights ID |
| region | VARCHAR(10) | Region code |
| is_demo | INTEGER | Is demo (0/1) |
| console | VARCHAR(10) | Console identifier (default: 'nx') |
| type | VARCHAR(20) | Game type (base/update/dlc) |
| version | INTEGER | Version number |
| updated_at | TIMESTAMP | Last update timestamp |

### nx_[lang]

Language-specific tables for game descriptions (11 tables: en, ja, es, de, fr, nl, pt, it, zh, ko, ru).

| Column | Type | Description |
|--------|------|-------------|
| tid | VARCHAR(16) | Title ID (Primary Key, Foreign Key) |
| intro | TEXT | Short introduction |
| description | TEXT | Full description |

### ctr

Main table storing Nintendo 3DS game information.

| Column | Type | Description |
|--------|------|-------------|
| tid | VARCHAR(16) | Title ID (Primary Key) |
| uid | VARCHAR(32) | Unique ID |
| name | TEXT | Game name |
| formal_name | TEXT | Formal game name |
| description | TEXT | Game description |
| release_date_on_eshop | VARCHAR(10) | Release date on eShop (YYYY-MM-DD) |
| product_code | VARCHAR(32) | Product code |
| platform_name | TEXT | Platform name |
| region | VARCHAR(50) | Region (uppercase ISO / market code, e.g. `JP`, `US`, `EU`) |
| genres | TEXT | Genres (JSON array) |
| features | TEXT | Features (JSON array) |
| languages | TEXT | Supported languages (JSON array, ISO-639) |
| rating_system | TEXT | Rating system (JSON object) |
| version | VARCHAR(20) | Version |
| disclaimer | TEXT | Disclaimer text |
| descriptors | TEXT | Descriptors (JSON array) |
| category | VARCHAR(64) | Category (`base`, `extras/hb`, …) |
| publisher | TEXT | Publisher name |
| smdh | TEXT | SMDH metadata (JSON object) |
| source_hash | VARCHAR(40) | Upstream content hash (change detection) |
| source_path | TEXT | Upstream metadata path |
| synced_at | TIMESTAMP | Last successful upstream sync |
| updated_at | TIMESTAMP | Last update timestamp |

### sync_log

Tracks synchronization history.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Auto-increment ID (Primary Key) |
| synced_at | TIMESTAMP | Sync timestamp |
| games_count | INTEGER | Number of games synced |
| status | VARCHAR(50) | Sync status |
| source | VARCHAR(100) | Sync source (`nx`, `titledb-multi`, `3dsdb`, …) |

## Automatic Synchronization

All sync jobs share a single queue: **only one sync runs at a time** (NX, TitleDB, or CTR).

### On startup

1. CTR metadata sync (smaller / faster)
2. NX TIDs
3. TitleDB

### Switch — NX TIDs (Daily at 3:00 AM)

**Source:** `https://nx-missing.ghostland.at/data/working.txt`

- Downloads list of all Nintendo Switch Title IDs
- Indexes base games (TIDs starting with `01` and ending with `000`)
- Creates database entries with TID only
- Then runs TitleDB enrichment in the same cron slot

### Switch — TitleDB (3:00 AM after NX, and 3:00 PM)

**Source:** `https://raw.githubusercontent.com/blawar/titledb/refs/heads/master/`

- Downloads game metadata from multiple regions
- Enriches existing TIDs with detailed information
- Supports 11 languages
- **Never overwrites existing non-null data**

### 3DS — CTR (4:00 AM & 4:00 PM)

- Maintains a **local git mirror** of `ghost-land/3dsdb` under `data/3dsdb` (clone once, then `git fetch`)
- Scans the mirror on disk — no GitHub API rate limits
- Diffs `meta.json` blob SHA vs `source_hash` (also re-fills incomplete rows with null `name`)
- Upserts changed metadata; copies missing media (`icon`, `banner`, `top_image`, screens, thumbs) into `media/ctr/`
- **Scheduled syncs** (04:00 / 16:00): if the mirror commit is unchanged since the last success → no-op
- **Startup sync**: always scans/repairs gaps even when the commit is unchanged

### Switch data priority rules

1. Existing (non-null) data is never overwritten by TitleDB
2. US.en is processed first for English content
3. Multiple regions provide data redundancy

## Installation

### Requirements

- Node.js **20.10+** (recommended: **24 LTS**)
- PostgreSQL 12+

### Database Setup

1. **Create PostgreSQL database:**

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE nlib_api;
CREATE USER nlib_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE nlib_api TO nlib_user;
\q
```

2. **Create tables:**

```bash
psql -h localhost -U nlib_user -d nlib_api -f database-schema.sql
```

### Application Setup

```bash
# Clone the repository
git clone https://github.com/ghost-land/Nlib-API.git
cd Nlib-API

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your database credentials

# Start the server
npm start
```

The server will start on port 3000 by default (configurable via `PORT` environment variable).

## Environment Variables

Copy `.env.example` to `.env` and configure your database credentials:

```bash
cp .env.example .env
```

Then edit `.env` with your PostgreSQL connection details.

## Development

```bash
# Run in development mode
npm start

# Enable debug logs
# Add DB_DEBUG=true to your .env file
```

## Media Storage Structure

Media files are organized by platform:

```
media/
├── nx/
│   └── [tid]/
│       ├── icon
│       ├── banner
│       ├── screens/
│       │   ├── screen_1
│       │   ├── screen_2
│       │   └── …
│       └── cache/
└── ctr/
    └── [category]/          # e.g. base, or extras/hb
        └── [tid]/
            ├── icon
            ├── banner
            ├── top_image
            ├── screen/
            │   ├── 1
            │   ├── 2
            │   └── …
            ├── screen_u/
            │   ├── 1_u
            │   ├── 1_l
            │   ├── 2_u
            │   ├── 2_l
            │   └── …
            └── thumb/
                ├── 1
                ├── 2
                └── …
```
- All media assets must be stored without file extensions; only the base name described above should exist on disk.
- Images are expected in JPEG format (original files can be JPEG; converted assets are served as JPEG by the API).

- **Nintendo Switch**: Metadata in PostgreSQL, media in `media/nx/[tid]/`
- **Nintendo 3DS**: Metadata in PostgreSQL (table `ctr`), media in `media/ctr/[category]/[tid]/`

## Important Notes

- All Title IDs are automatically converted to uppercase
- Endpoints can be called with or without trailing slashes
- All images are served in JPEG format
- **Nintendo Switch**:
  - Icons support optional resizing (30-4096 pixels, rounded to nearest 10) and are always square
  - Banners support multiple sizes: 240p, 360p, 480p, 540p, 720p, 1080p
  - Banners support custom dimensions: `/banner/:width/:height` (100-1920 x 100-1080)
  - Resized images are cached on disk for optimal performance
- **Nintendo 3DS**:
  - Screenshots are available in compiled and uncompiled formats
  - Uncompiled screenshots separate upper (`u`) and lower (`l`) screens
  - Regions use uppercase ISO / market codes (`JP`, `US`, `EU`, `FREE`, …)
  - Response includes `publisher`, `smdh`, and `category`
- Screenshot URLs are generated dynamically based on the API domain
- Database synchronization runs automatically (serialized queue)
- API responses use standard HTTP status codes (200, 404, 500)

## License

This project is licensed under the GPL-3.0 License - see the LICENSE file for details.

## Credits

- Switch game data from [TitleDB](https://github.com/blawar/titledb)
- Nintendo Switch Title IDs from [nx-missing](https://nx-missing.ghostland.at/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
