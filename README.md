# Nlib API

A modern and performant REST API for Nintendo game library data. Access game information, media assets, screenshots, and comprehensive statistics across Nintendo platforms.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://opensource.org/licenses/GPL-3.0)

## Features

- 🎮 Complete Nintendo Switch game database
- 🖼️ Game icons, banners, and screenshots
- 🌍 Multi-language support (11 languages)
- 📊 Comprehensive statistics
- 🔄 Automatic daily synchronization with TitleDB
- 🚀 Fast and lightweight

## API Documentation

### Base URL

The API is accessible at your deployment URL. All endpoints support trailing slashes.

### Nintendo Switch Endpoints

#### Get Game Information

```http
GET /nx/:tid?lang=en
```

**Parameters:**
- `tid` (required) - 16-character hexadecimal Title ID
- `lang` (optional) - Language code, default: `en`
  - Available: `en`, `ja`, `es`, `de`, `fr`, `nl`, `pt`, `it`, `zh`, `ko`, `ru`

**Example Request:**
```http
GET /nx/01007EF00011E000?lang=fr
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

Note: Media URLs (`icon`, `banner`, `screens`) are only included if the corresponding media files are available for the game.

#### Get Game Icon

```http
GET /nx/:tid/icon/:width?/:height?
```

**Parameters:**
- `width` (optional) - Size in pixels (60-4096). Automatically rounded to nearest 10.
- `height` (optional) - Must equal width if provided. Icons are always square.

Returns the game icon in JPEG format. If no size is specified, returns the original image.

**Examples:**
```http
GET /nx/01007EF00011E000/icon              # Original size
GET /nx/01007EF00011E000/icon/64           # 60x60 (rounded)
GET /nx/01007EF00011E000/icon/67           # 70x70 (rounded)
GET /nx/01007EF00011E000/icon/256          # 260x260 (rounded)
GET /nx/01007EF00011E000/icon/256/256      # 260x260 (explicit)
GET /nx/01007EF00011E000/icon/512/512      # 510x510 (rounded)
GET /nx/01007EF00011E000/icon/1024         # 1020x1020 (rounded)
```

**Notes:**
- Icons are always square
- Sizes are automatically rounded to the nearest 10 pixels for cache optimization
- Minimum size: 60 pixels
- Both `/icon/256` and `/icon/256/256` produce identical results
- Response header `X-Size-Rounded` shows the actual size served (e.g., `64->60`)

#### Get Game Banner

```http
GET /nx/:tid/banner/:size?
```

**Parameters:**
- `size` (optional) - Banner size
  - Shortcuts: `240`/`240p`, `360`/`360p`, `480`/`480p`, `540`/`540p`, `720`/`720p`, `1080`/`1080p`
  - Widths: `426`, `640`, `854`, `960`, `1280`, `1920`
  - Default: 1920x1080 (1080p)
  - Supported sizes: 426x240, 640x360, 854x480, 960x540, 1280x720, 1920x1080

Returns the game banner in JPEG format.

**Examples:**
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

**Example Response:**
```json
{
  "success": true,
  "data": {
    "total_games": 15420,
    "last_sync": "2025-10-12T10:30:00Z",
    "by_type": { "base": 12000, "update": 2500, "dlc": 920 },
    "games_vs_demos": { "games": 14800, "demos": 620 },
    "by_region": { "US": 8500, "EU": 4200, "JP": 2720 },
    "by_console": { "nx": 15420 },
    "top_publishers": [
      { "name": "Nintendo", "games_count": 450 }
    ],
    "recent_updates": [
      { "tid": "0100ABC001234000", "name": "Example Game", "updated_at": "..." }
    ]
  }
}
```

### System Endpoints

#### Uptime Status

```http
GET /uptime
```

Returns server status and uptime information.

## Database Schema

### games

Main table storing game information.

| Column | Type | Description |
|--------|------|-------------|
| tid | TEXT | Title ID (Primary Key) |
| name | TEXT | Game name |
| publisher | TEXT | Publisher name |
| developer | TEXT | Developer name |
| release_date | TEXT | Release date (YYYY-MM-DD) |
| category | TEXT | Categories (JSON array) |
| languages | TEXT | Supported languages (JSON array) |
| nsu_id | INTEGER | Nintendo eShop ID |
| number_of_players | INTEGER | Number of players |
| rating_content | TEXT | Rating content (JSON array) |
| rights_id | TEXT | Rights ID |
| region | TEXT | Region code |
| is_demo | INTEGER | Is demo (0/1) |
| console | TEXT | Console identifier (default: 'nx') |
| type | TEXT | Game type (base/update/dlc) |
| version | INTEGER | Version number |
| updated_at | DATETIME | Last update timestamp |

### nx_[lang]

Language-specific tables for game descriptions (11 tables: en, ja, es, de, fr, nl, pt, it, zh, ko, ru).

| Column | Type | Description |
|--------|------|-------------|
| tid | TEXT | Title ID (Primary Key, Foreign Key) |
| intro | TEXT | Short introduction |
| description | TEXT | Full description |

### sync_log

Tracks synchronization history.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment ID (Primary Key) |
| synced_at | DATETIME | Sync timestamp |
| games_count | INTEGER | Number of games synced |
| status | TEXT | Sync status |
| source | TEXT | Sync source |

## Automatic Synchronization

The API uses a two-stage synchronization system:

### Stage 1: NX TIDs (Daily at 3:00 AM)

**Source:** `https://nx-missing.ghostland.at/data/working.txt`

- Downloads list of all Nintendo Switch Title IDs
- Indexes base games (TIDs starting with `01` and ending with `000`)
- Creates database entries with TID only

### Stage 2: TitleDB (Every 12 hours at 3:00 AM & 3:00 PM)

**Source:** `https://raw.githubusercontent.com/blawar/titledb/refs/heads/master/`

- Downloads game metadata from multiple regions
- Enriches existing TIDs with detailed information
- Supports 11 languages
- **Never overwrites existing data** - preserves data quality

### Data Priority Rules

1. Existing (non-null) data is never overwritten
2. US.en is processed first for English content
3. Multiple regions provide data redundancy

## Installation

### Requirements

- Node.js 18+ or Bun
- SQLite3

### Setup

```bash
# Clone the repository
git clone https://github.com/ghost-land/Nlib-API.git
cd Nlib-API

# Install dependencies
npm install

# Start the server
npm start
```

The server will start on port 3000 by default (configurable via `PORT` environment variable).

## Environment Variables

```bash
PORT=3000  # Server port (default: 3000)
```

## Development

```bash
# Run with auto-reload
npm run dev

# Run with Bun
bun run start
```

## Important Notes

- All Title IDs are automatically converted to uppercase
- Endpoints can be called with or without trailing slashes
- All images are served in JPEG format
- Icons support optional resizing (60-4096 pixels, rounded to nearest 10) and are always square
- Banners support multiple sizes: 240p, 360p, 480p, 540p, 720p, 1080p
- Resized images are cached on disk for optimal performance
- Screenshot URLs are generated dynamically based on the API domain
- Database synchronization runs automatically
- API responses use standard HTTP status codes (200, 404, 500)

## License

This project is licensed under the GPL-3.0 License - see the LICENSE file for details.

## Credits

- Game data sourced from [TitleDB](https://github.com/blawar/titledb)
- Nintendo Switch Title IDs from [nx-missing](https://nx-missing.ghostland.at/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
