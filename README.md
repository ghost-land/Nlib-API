# NX API Documentation

This document provides an overview of the endpoints available in the NX API, which returns game-related data in JSON format.

## Endpoints

### Game Information

#### `GET api.nlib.cc/nx/[tid]`
Returns JSON with information based on the provided Title ID (tid). The response can include data for DLCs, updates, base games, or retro console forwarders.

- **Examples**:
  - [Base Game](#get-apinlibccnxtidbase)
  - [Update](#get-apinlibccnxupdatetid)
  - [DLC](#get-apinlibccnxdltid)
  - **Retro Game Forwarder**:
    ```json
    {
      "id": "0512200000a10000",
      "name": "Hot Wheels Turbo Racing [N64]",
      "size": 22242936,
      "releaseDate": 19990511,
      "description": "Hot Wheels Turbo Racing is a racing video game released for the Nintendo 64 and PlayStation in 1999. It features 40 cars based on the Hot Wheels series of toys. It also features Kyle Petty's 1999 NASCAR stock car, as it was sponsored by Hot Wheels. The game features music from artists like Primus, Metallica, The Reverend Horton Heat and Mix Master Mike.",
      "console": "n64",
      "type": "retro"
    }
    ```

#### `GET api.nlib.cc/nx/base/[tid]`
Returns JSON with game information for base games.

- **Example**:
    ```json
    {
      "description": "Explore incredible places far from the Mushroom Kingdom as you join Mario and his new ally Cappy on a massive, globe-trotting 3D adventure. Use amazing new abilities—like the power to capture and control objects, animals, and enemies—to collect Power Moons so you can power up the Odyssey airship and save Princess Peach from Bowser’s wedding plans!\n\nThanks to heroic, hat-shaped Cappy, Mario’s got new moves that’ll make you rethink his traditional run-and-jump gameplay—like cap jump, cap throw, and capture. Use captured cohorts such as enemies, objects, and animals to progress through the game and uncover loads of hidden collectibles. And if you feel like playing with a friend, just pass them a Joy-Con™ controller! Player 1 controls Mario while Player 2 controls Cappy. This sandbox-style 3D Mario adventure—the first since 1996’s beloved Super Mario 64™ and 2002’s Nintendo GameCube™ classic Super Mario Sunshine™—is packed with secrets and surprises, plus exciting new kingdoms to explore.",
      "id": "0100000000010000",
      "name": "Super Mario Odyssey™",
      "publisher": "Nintendo",
      "releaseDate": 20171027,
      "version": 0,
      "category": ["Platformer", "Action"],
      "developer": null,
      "intro": "Embark on a cap-tivating, globe-trotting adventure",
      "isDemo": false,
      "languages": ["ja", "en", "es", "fr", "de", "it", "nl", "ru", "zh", "zh"],
      "nsuId": 70010000001130,
      "numberOfPlayers": 2,
      "ratingContent": [
        "Cartoon Violence",
        "Comic Mischief"
      ],
      "region": null,
      "rightsId": "01000000000100000000000000000003",
      "console": "nx",
      "type": "base"
    }
    ```

#### `GET api.nlib.cc/nx/dlc/[tid]`
Returns JSON with game information for DLCs.

- **Example**:
    ```json
    {
      "id": "01007EF00011F001",
      "name": "The Legend of Zelda: Breath of the Wild DLC Pack 1",
      "publisher": "Nintendo",
      "releaseDate": 20170630,
      "description": "DLC Pack 1 'The Master Trials' includes Trial of the Sword, Hero's Path Mode, Master Mode, Travel Medallion, 8 clothing items honoring the legacy of The Legend of Zelda series, and Korok Mask.",
      "version": 0,
      "console": "nx",
      "type": "dlc"
    }
    ```

#### `GET api.nlib.cc/nx/update/[tid]`
Returns JSON with game information for updates.

- **Example**:
    ```json
    {
      "id": "0100901014412800",
      "version": 131072,
      "console": "nx",
      "type": "update"
    }
    ```

#### `GET api.nlib.cc/nx/full` or `GET api.nlib.cc/nx/all`
Returns the full games database JSON. This is not recommended due to the large size of the response.

- **Example**:
    ```json
    {
      "titledb": {
        "0100000000010000": {
          "id": "0100000000010000",
          "name": "Super Mario Odyssey™",
          "publisher": "Nintendo",
          "releaseDate": 20171027,
          "description": "Explore incredible places far from the Mushroom Kingdom as you join Mario and his new ally Cappy on a massive, globe-trotting 3D adventure.",
          "version": 0
        },
        "010000000E5EE000": {
          "id": "010000000E5EE000",
          "name": "8-BIT YU-NO'S GREAT ADVENTURE",
          "publisher": "Spike Chunsoft US",
          "releaseDate": 20231026,
          "description": "A 2D platformer in 8-bit style set in the YU-NO universe. Play as Yu-No as she fights and dodges monsters in a fantasy world.",
          "version": 0
        }
        ...
      }
    }
    ```

### Game Assets

#### `GET api.nlib.cc/nx/[tid]/icon`
Returns the game icon (1024x1024 JPEG).

#### `GET api.nlib.cc/nx/[tid]/banner`
Returns the game banner (1980x1080 JPEG).

#### `GET api.nlib.cc/nx/[tid]/screen/[screen_id]`
Returns a specific screenshot of the game (JPEG). If `screen_id` is not specified, the first screenshot is returned by default.

- **Example**: `api.nlib.cc/nx/[tid]/screen/1` returns the first screenshot.
- **Note**: Returns 404 if `screen_id` is out of range.

#### `GET api.nlib.cc/nx/[tid]/screens`
Returns JSON with the count and URLs of all available screenshots.

- **Example**:
    ```json
    {
      "count": 3,
      "screens": [
        "https://api.nlib.cc/nx/0100000000010000/screen/1",
        "https://api.nlib.cc/nx/0100000000010000/screen/2",
        "https://api.nlib.cc/nx/0100000000010000/screen/3"
      ]
    }
    ```

### System

#### `GET api.nlib.cc/uptime`
Returns `200 OK` if the API is up and running.

---

**Note**: Replace `[tid]` with the actual title ID of the game. Title IDs should be in uppercase.