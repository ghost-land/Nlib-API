# Nlib API Documentation

## Endpoints

### Home
- `GET /` - Home page

### Uptime
- `GET /uptime` - Server status

### Nintendo Switch Games (NX)

#### Get game by TID
```
GET /nx/:tid?lang=en
```

**Parameters:**
- `tid` (required) - Title ID (16 characters)
- `lang` (optional) - Language code (default: `en`)
  - Available: `en`, `ja`, `es`, `de`, `fr`, `nl`, `pt`, `it`, `zh`, `ko`, `ru`

**Example:**
```
GET /nx/01007EF00011E000
GET /nx/01007EF00011E000?lang=ja
GET /nx/01007EF00011E000?lang=fr
```

**Response (if found):**
```json
{
  "description": "Forget everything you know about...",
  "id": "01007EF00011E000",
  "name": "The Legend of Zelda™: Breath of the Wild",
  "publisher": "Nintendo",
  "releaseDate": "2017-03-03",
  "version": 0,
  "category": ["Adventure", "Action", "RPG", "Other"],
  "developer": null,
  "intro": "STEP INTO A WORLD OF ADVENTURE",
  "isDemo": false,
  "languages": ["ja", "en", "es", "fr", "pt", "de", "it", "nl", "ru", "ko", "zh"],
  "nsuId": 70010000000025,
  "numberOfPlayers": 1,
  "ratingContent": ["Fantasy Violence", "Mild Suggestive Themes", "Use of Alcohol"],
  "region": null,
  "rightsId": "01007EF00011E0000000000000000000",
  "console": "nx",
  "type": "base"
}
```

**Response (if not found):**
```json
{
  "success": false,
  "error": "Game not found"
}
```

#### Get icon
```
GET /nx/:tid/icon
```

**Example:**
```
GET /nx/01007EF00011E000/icon
```

**Response:** JPEG image file

---

#### Get banner
```
GET /nx/:tid/banner
```

**Example:**
```
GET /nx/01007EF00011E000/banner
```

**Response:** JPEG image file

---

#### Get screenshot
```
GET /nx/:tid/screen/:index
```

**Parameters:**
- `index` - Screenshot index (1-based, integer)

**Example:**
```
GET /nx/01007EF00011E000/screen/1
GET /nx/01007EF00011E000/screen/3
```

**Response:** JPEG image file

---

#### Get all screenshots list
```
GET /nx/:tid/screens
```

**Example:**
```
GET /nx/0100F52019002000/screens
```

**Response:**
```json
{
  "count": 6,
  "screenshots": [
    "https://api.nlib.cc/nx/0100F52019002000/screen/1",
    "https://api.nlib.cc/nx/0100F52019002000/screen/2",
    "https://api.nlib.cc/nx/0100F52019002000/screen/3",
    "https://api.nlib.cc/nx/0100F52019002000/screen/4",
    "https://api.nlib.cc/nx/0100F52019002000/screen/5",
    "https://api.nlib.cc/nx/0100F52019002000/screen/6"
  ]
}
```

**Response (no screenshots):**
```json
{
  "count": 0,
  "screenshots": []
}
```

---

#### Get statistics
```
GET /nx/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_games": 1234,
    "last_sync": {
      "id": 1,
      "synced_at": "2025-10-12 10:30:00",
      "games_count": 1234,
      "status": "success"
    }
  }
}
```

#### Manual sync - NX TIDs (for testing)
```
POST /nx/sync/tids
```

**Response:**
```json
{
  "success": true,
  "total": 19252,
  "inserted": 10,
  "duration": 1234
}
```

#### Manual sync - TitleDB (for testing)
```
POST /nx/sync/titledb
```

**Response:**
```json
{
  "success": true,
  "processed": 16634,
  "added": 100,
  "updated": 16534,
  "skipped": 14684,
  "duration": 45000
}
```

## Database Schema

### games
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
| region | TEXT | Region |
| is_demo | INTEGER | Is demo (0/1) |
| console | TEXT | Console (default: 'nx') |
| type | TEXT | Type (default: 'base') |
| version | INTEGER | Version number |
| updated_at | DATETIME | Last update timestamp |

### nx_[lang] (lang: en, ja, es, de, fr, nl, pt, it, zh, ko, ru)
| Column | Type | Description |
|--------|------|-------------|
| tid | TEXT | Title ID (Primary Key, Foreign Key) |
| intro | TEXT | Short introduction |
| description | TEXT | Full description |

### sync_log
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment ID (Primary Key) |
| synced_at | DATETIME | Sync timestamp |
| games_count | INTEGER | Number of games synced |
| status | TEXT | Sync status (success/failed) |
| source | TEXT | Sync source (nx_tids, titledb-multi) |

## Automatic Sync

The API uses a two-stage synchronization system:

### Stage 1: NX TIDs (Daily at 3:00 AM)
Source: `https://nx-missing.ghostland.at/data/working.txt`
- Downloads list of all Nintendo Switch Title IDs
- Only indexes base games (TIDs starting with `01` and ending with `000`)
- Creates entries in the database with TID only

### Stage 2: TitleDB (Every 12 hours at 3:00 AM & 3:00 PM)
Source: `https://raw.githubusercontent.com/blawar/titledb/refs/heads/master/`
- Downloads game metadata from multiple regions and languages
- Enriches existing TIDs with game information
- Supports 11 languages: EN, JA, ES, DE, FR, NL, PT, IT, ZH, KO, RU
- **IMPORTANT**: Never overwrites existing (non-null) data

### Data Priority Rules
1. Once a field has data (not null), it is NEVER overwritten
2. US.en is processed first for English content
3. Multiple regions per language provide data redundancy

## Running the API

```bash
npm install
npm start
```

The server will start on port 3000 by default.

