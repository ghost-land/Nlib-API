# NX API Documentation

This document provides an overview of the endpoints available in the NX API, which returns game-related data in JSON format.

## Endpoints

### Game Information

#### `GET api.nlib.cc/nx/[tid]`
Returns JSON with information based on the provided Title ID (tid). The response can include data for DLCs, updates, base games, or retro console forwarders.

- **Notes**:
  - Replace `[tid]` with the actual title ID of the game.
  - **Date format**: All dates in the response follow the `YYYY-MM-DD` format, ensuring consistency across the API.
  - **Size**: The `size` field in the response always represents the size in bytes.

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
      "releaseDate": "1999-05-11",
      "description": "Hot Wheels Turbo Racing is a racing video game released for the Nintendo 64 and PlayStation in 1999. It features 40 cars based on the Hot Wheels series of toys. It also features Kyle Petty's 1999 NASCAR stock car, as it was sponsored by Hot Wheels. The game features music from artists like Primus, Metallica, The Reverend Horton Heat and Mix Master Mike.",
      "console": "n64",
      "type": "retro"
    }
    ```

#### `GET api.nlib.cc/nx/base/[tid]`
Returns JSON with game information for base games.

- **Notes**:
  - **Date format**: Dates in the response use the `YYYY-MM-DD` format.
  - **Size**: The `size` field is always in bytes.

- **Example**:
    ```json
    {
      "description": "Explore incredible places far from the Mushroom Kingdom as you join Mario and his new ally Cappy on a massive, globe-trotting 3D adventure. Use amazing new abilities—like the power to capture and control objects, animals, and enemies—to collect Power Moons so you can power up the Odyssey airship and save Princess Peach from Bowser’s wedding plans!\n\nThanks to heroic, hat-shaped Cappy, Mario’s got new moves that’ll make you rethink his traditional run-and-jump gameplay—like cap jump, cap throw, and capture. Use captured cohorts such as enemies, objects, and animals to progress through the game and uncover loads of hidden collectibles. And if you feel like playing with a friend, just pass them a Joy-Con™ controller! Player 1 controls Mario while Player 2 controls Cappy. This sandbox-style 3D Mario adventure—the first since 1996’s beloved Super Mario 64™ and 2002’s Nintendo GameCube™ classic Super Mario Sunshine™—is packed with secrets and surprises, plus exciting new kingdoms to explore.",
      "id": "0100000000010000",
      "name": "Super Mario Odyssey™",
      "publisher": "Nintendo",
      "releaseDate": "2017-10-27",
      "version": 0,
      "category": ["Platformer", "Action"],
      "developer": null,
      "intro": "Embark on a cap-tivating, globe-trotting adventure",
      "isDemo": false,
      "languages": ["ja", "en", "es", "fr", "de", "it", "nl", "ru", "zh", "zh"],
      "nsuId": 70010000001130,
      "numberOfPlayers": 2,
      "ratingContent": ["Cartoon Violence", "Comic Mischief"],
      "region": null,
      "rightsId": "01000000000100000000000000000003",
      "console": "nx",
      "type": "base"
    }
    ```

#### `GET api.nlib.cc/nx/dlc/[tid]`
Returns JSON with game information for DLCs.

- **Notes**:
  - **Size**: Always represented in bytes.
  - **Date format**: Dates use the `YYYY-MM-DD` format.

- **Example**:
    ```json
    {
      "id": "01007EF00011F001",
      "name": "The Legend of Zelda: Breath of the Wild DLC Pack 1",
      "publisher": "Nintendo",
      "releaseDate": "2017-06-30",
      "description": "DLC Pack 1 'The Master Trials' includes Trial of the Sword, Hero's Path Mode, Master Mode, Travel Medallion, 8 clothing items honoring the legacy of The Legend of Zelda series, and Korok Mask.",
      "version": 0,
      "console": "nx",
      "type": "dlc"
    }
    ```

#### `GET api.nlib.cc/nx/update/[tid]`
Returns JSON with game information for updates.

- **Notes**:
  - **Size**: File sizes are always in bytes.
  - **Date format**: Dates follow the `YYYY-MM-DD` format across all fields.

- **Example**:
    ```json
    {
      "id": "01006A800016E800",
      "base_tid": "01006A800016E000",
      "name": "Super Smash Bros.™ Ultimate",
      "description": "Gaming icons clash in the ultimate brawl you can play anytime, anywhere! Smash rivals off the stage as new characters Simon Belmont and King K. Rool join Inkling, Ridley, and every fighter in Super Smash Bros. history. Enjoy enhanced speed and combat at new stages based on the Castlevania series, Super Mario Odyssey, and more!\n\nHaving trouble choosing a stage? Then select the Stage Morph option to transform one stage into another while battling—a series first! Plus, new echo fighters Dark Samus, Richter Belmont, and Chrom join the battle. Whether you play locally or online, savor the faster combat, new attacks, and new defensive options, like a perfect shield. Jam out to 900 different music compositions and go 1-on-1 with a friend, hold a 4-player free-for-all, kick it up to 8-player battles and more! Feel free to bust out your GameCube controllers—legendary couch competitions await—or play together anytime, anywhere!",
      "publisher": "Nintendo",
      "base_release_date": "2018-12-07",
      "first_update_release_date": "2018-12-04",
      "latest_update_release_date": "2024-02-15",
      "latest_update": {
          "version": "1835008",
          "release_date": "2024-02-15"
      },
      "versions": {
          "65536": "2018-12-04",
          "131072": "2018-12-13",
          "196608": "2018-12-21",
          "262144": "2019-01-29",
          "327680": "2019-02-22",
          "393216": "2019-04-02",
          "458752": "2019-04-17",
          "524288": "2019-04-25",
          "589824": "2019-05-30",
          "655360": "2019-07-30",
          "720896": "2019-09-05",
          "786432": "2019-11-06",
          "851968": "2019-11-14",
          "917504": "2020-01-07",
          "983040": "2020-01-28",
          "1048576": "2020-06-29",
          "1114112": "2020-08-05",
          "1179648": "2020-10-13",
          "1245184": "2020-10-21",
          "1310720": "2020-11-11",
          "1376256": "2020-12-17",
          "1441792": "2020-12-22",
          "1507328": "2021-03-04",
          "1572864": "2021-03-23",
          "1638400": "2021-06-29",
          "1703936": "2021-10-18",
          "1769472": "2021-12-01",
          "1835008": "2024-02-15"
      },
      "category": ["Action", "Fighting", "Multiplayer"],
      "intro": "New characters and stages join the entire legacy roster!\n",
      "isDemo": false,
      "languages": ["ja", "en", "es", "fr", "de", "it", "nl", "ru", "ko", "zh", "zh"],
      "numberOfPlayers": 8,
      "ratingContent": ["Cartoon Violence", "Comic Mischief", "Suggestive Themes", "Users Interact", "In-Game Purchases"],
      "region": null
    }
    ```

#### `GET api.nlib.cc/nx/full` or `GET api.nlib.cc/nx/all`
Returns the full games database JSON. This is NOT RECOMMENDED due to the large size of the response.

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

#### `GET api.nlib.cc/nx/[tid]/icon/[width]/[height]`
Returns the game icon. If `width` and `height` are not specified, the default size of 1024x1024 JPEG is returned.

#### `GET api.nlib.cc/nx/[tid]/banner/[width]/[height]`
Returns the game banner. Supported sizes are 1920x1080 and 1280x720. You can also use `/banner/720p` or `/banner/1080p`. If neither `width` nor `height` is specified, the default size of 1920x1080 JPEG is returned.

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
