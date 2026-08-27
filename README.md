# Image Aligner for Obsidian

[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-purple.svg)](https://obsidian.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.3.0-emerald.svg)](manifest.json)

**Image Aligner** is a lightweight, high-performance Obsidian plugin to align images **Left**, **Center**, or **Right** with a single click.

It adds an intuitive floating toolbar when hovering over images in Live Preview, keeps images permanently aligned, preserves native image resizing (`|300`), and exports cleanly to PDF.

---

## ✨ Features

- **⚡ 1-Click Floating Toolbar:** Hover over any image in Live Preview to align it Left, Center, or Right.
- **📍 Top-Left Positioning:** Sits neatly at the image's top-left corner, avoiding any overlap with Obsidian's native embed controls in the top-right.
- **🔒 Permanent Alignment:** Images in your notes stay aligned automatically from the moment you open the note. Leaving the mouse cursor never resets or unaligns your images.
- **📐 Native Resizing Preserved:** Full compatibility with Obsidian's size parameters (e.g. `![[image.png|300]]`, `![[image.png|200x150]]`) and corner drag-resizing handles. Never stretches images to 100% width.
- **📄 100% Reliable PDF Export:** Uses print-tested block margin rules in `@media print` to guarantee that exported PDFs accurately retain your image alignments.
- **🚀 Active-Page Scoped Performance (v2.3):** Dynamically scopes CSS generation *strictly* to the note you currently have open. Whether you have 10 images or 10,000+ images in your vault, performance remains blazing fast with zero lag.
- **🎨 Theme Adaptive:** Automatically adopts your Obsidian theme's background colors, border styles, and accent colors in both Light and Dark modes.
- **🧹 Clean Markdown:** Stores alignment settings non-destructively in plugin data (`data.json`), keeping your raw markdown files clean and untouched.

---

## 🛠️ Installation

### Manual Installation
1. Download the latest release files (`main.js`, `manifest.json`, `styles.css`).
2. In your Obsidian vault, navigate to the plugins folder:
   ```
   <VaultFolder>/.obsidian/plugins/
   ```
3. Create a new folder named `image-aligner-thesiddikhamim`.
4. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
5. Open Obsidian, go to **Settings** > **Community plugins**, click the **Refresh** button, and enable **Image Aligner**.

### Using BRAT
1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian-42-brat) in Obsidian.
2. In Obsidian Settings, go to **BRAT** > **Add Beta plugin**.
3. Paste the repository URL: `thesiddikhamim/obsidian-image-align`.
4. Enable the plugin under Community Plugins.

---

## 📖 How to Use

1. **Align an Image:**
   - In **Live Preview**, hover your cursor over any image embed or link.
   - Click **Left**, **Center**, or **Right** on the top-left floating toolbar.
2. **Reset / Remove Alignment:**
   - Click the currently active alignment button again to toggle it off and return to default alignment.
3. **Resize Images:**
   - Use standard Obsidian pipe syntax (e.g. `![[photo.png|400]]`) or drag the resize handle at the bottom-right of the image. The alignment will adjust to the new size dynamically.
4. **Export to PDF:**
   - Go to **File menu (three dots)** > **Export to PDF**. Your image alignments will be preserved in the output PDF document.

---

## 🏗️ Architecture & Performance

Unlike traditional plugins that either modify raw Markdown files or inject thousands of global CSS selectors into `<head>`, Image Aligner uses an **Active-Page Scoped** engine:
- When you open or switch to a note, Image Aligner inspects only the images present on that active page.
- It dynamically compiles CSS rules only for those specific images.
- Images render with full visual stability at locked **60+ FPS** during scrolling and typing.

---

## 👤 Author

Developed by **[thesiddikhamim](https://github.com/thesiddikhamim)**.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
