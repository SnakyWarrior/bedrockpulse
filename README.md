# BedrockPulse

A small desktop app for Windows that keeps your **Minecraft Bedrock addons** up to date.

It reads the addons installed in your `com.mojang` folder, finds where each one comes from, checks whether a newer
version exists, and installs it over the old one. The interface is built with
[Ore UI for the web](https://katorly.dev/OreUI), so it looks like the game.

> BedrockPulse is an unofficial fan project. It is not affiliated with Mojang, Microsoft or CurseForge.

## What it does

- Scans `behavior_packs` and `resource_packs` and groups a behavior pack and its resource pack into one addon.
- **Add link** accepts a page from CurseForge, MCPEDL or the Marketplace and works out the site by itself.
- **Check for updates** compares the installed version with the latest one from each source.
- **Update** installs the new version over the old one. No backup copy is kept. The new files are unpacked to a
  temporary folder first, and the installed pack is only replaced if that succeeds.

## Sources

| Source | How it is read | Update |
| --- | --- | --- |
| CurseForge | Official API (needs your own free API key) | Installed directly when the API allows downloads |
| MCPEDL | The page's "Updated" date (the site shows no addon version) | Opens the page; you install the downloaded file |
| Minecraft Marketplace | Item id, resolved through public listing sites | Opens the page; you install the downloaded file |

The app only **reads** version information. It does not download or decrypt Marketplace content.

### CurseForge API key

Create a key at [console.curseforge.com](https://console.curseforge.com) and paste it in **Settings**. Without
search access on the key, paste the numeric **Project ID** of the addon instead of its URL.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run electron:dev
```

For development with live reload, run `npx vite` in one terminal, then in another:

```powershell
$env:VITE_DEV_SERVER_URL='http://localhost:5173'; npx electron .
```

## How it is built

- Electron (main process: folder scan, network, installing packs) and React with Vite for the interface.
- `electron/main.cjs` contains the scanning and installing code. `src/sources/` has one small module per source.
- Links and settings are stored in `state.json` in the app's user data folder.

## Credits

- [OreUI](https://github.com/katorlys/OreUI) (`oreui-web`), an unofficial fan-made Ore UI component library.
