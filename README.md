# 📺 YouTube Focus Mode: No Shorts, No Clickbait 🎯

A **Firefox extension** that helps you stay **focused** on YouTube by: 
<br>✅ Blurring all video thumbnails (unblur on hover) 👀
<br>✅ Removing all Shorts videos and sections 🚫
<br>✅ Auto-pausing videos on hover ⏯️
<br>✅ Removing ad blocker detection popups 🛡️
<br>✅ **Tracking cumulative watch time** and reminding you to take breaks ⏰

---

## ✨ Features

### ⏰ Time Reminder (New!)

- **Tracks total time spent watching videos** across multiple YouTube pages/videos
- Prompts you to take a break after a configurable interval
- Helps maintain awareness of your viewing habits and encourages mindful use

### 🔍 Thumbnail Blurring

- All YouTube video thumbnails are **blurred by default**
- Hover over a thumbnail to reveal its contents 👁️
- Reduces distraction and **clickbait influence**

### 🚫 Shorts Removal

- **Removes the Shorts section** from the YouTube homepage
- **Hides the Shorts button** from the sidebar navigation
- **Filters out Shorts** from recommendations & search results

### ⏯️ Smart Video Controls

- **Auto-pause videos** when hovering over them
- **Resume playback** when moving cursor away
- Works with both main video and previews
- Perfect for **multitasking** and **bandwidth saving**

### 🛡️ Ad Blocker Protection

- **Automatically removes** ad blocker detection popups
- Ensures **uninterrupted viewing experience**
- Works silently in the background
- Toggle on/off as needed

---

## 🖼️ Screenshots

Here are some screenshots of the extension in action:

<img src="docs/screenshots/screenshot6.png" width="400" alt="Extension popup interface">
<img src="docs/screenshots/screenshot1.png" width="2000" alt="Blurred thumbnails">
<img src="docs/screenshots/screenshot2.png" width="2000" alt="Shorts removed">
<img src="docs/screenshots/screenshot3.png" width="2000" alt="Clean interface">
<img src="docs/screenshots/screenshot7.png" width="2000" alt="Video controls">

---

## 🛠️ Installation

### 🔹 Manual Installation (Developer Mode)

1. **Download or clone** this repository
2. Open **Firefox** and navigate to `about:debugging`
3. Click **"This Firefox"**
4. Click **"Load Temporary Add-on..."**
5. Select the `manifest.json` file from the downloaded repository

---

## 🎯 Usage

Once installed, the extension will automatically:

- Blur all YouTube thumbnails 🖼️
- Remove Shorts videos and sections 🚫
- Enable video pause on hover ⏯️
- Remove ad blocker popups 🛡️
- **Start tracking your cumulative watch time** ⏰

You can configure the extension by clicking on its **toolbar icon**:

- **Toggle thumbnail blurring** on/off 🎛️
- **Toggle Shorts removal** on/off 🎚️
- **Toggle video pause** on hover 🎮
- **Toggle popup removal** on/off 🛡️
- **Toggle time reminder** on/off and configure interval ⚙️

---

## 🚀 Development & Releases

This project uses an automated release pipeline powered by GitHub Actions. To maintain consistent versioning and high-quality releases, we follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.

### Automated Release Process
When changes are merged into the `main` branch, our workflow analyzes the commit messages:

| Commit Prefix | Action Taken | Version Bump | Trigger Store Publish? |
| :--- | :--- | :--- | :--- |
| `feat:` | **GitHub Release** | Minor (`3.1.0`) | ❌ No |
| `fix:` | **GitHub Release** | Patch (`3.0.1`) | ❌ No |
| `publish:` | **GitHub + Store** | Patch (`3.0.1`) | ✅ **Yes** |
| `publish: feat:` | **GitHub + Store** | Minor (`3.1.0`) | ✅ **Yes** |
| `docs:`, `chore:` | None | No change | ❌ No |

**Strategy**:
*   Use `feat:` or `fix:` for iterative development and internal/beta testing via GitHub Release artifacts.
*   Use `publish:` (or `publish: feat:`) only when the code is stable and ready for public review on the Firefox Add-ons store.

**Smart Filtering**: Changes exclusively to the `docs/` folder, `README.md`, or issue templates will **not** trigger a new extension release, even if they use the prefixes above.

### Building Locally
1. Install dependencies: `npm install`
2. Build for Chrome: `npm run build:chrome`
3. Build for Firefox: `npm run build:firefox`
4. Build all (Production): `npm run build`

---

## 🔒 Privacy

This extension:
✅ **Does not collect any user data** 🔐
✅ **Does not communicate with any external servers** 🚫🌍
✅ **Only modifies YouTube's visual elements** 🖥️
✅ **Works completely offline** 🏠

---

## 📜 License

**MIT License**

---

Made with ❤️ to keep YouTube distraction-free! 🚀
