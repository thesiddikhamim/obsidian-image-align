# Image Align & Caption for Obsidian

[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-purple.svg)](https://obsidian.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-3.0.0-emerald.svg)](manifest.json)

**Image Align & Caption** is a lightweight, high-performance Obsidian plugin to align images (**Left**, **Center**, or **Right**) and display beautiful, synchronized captions underneath them in both **Live Preview** and **Reading View**.

It combines a 1-click floating alignment toolbar, active-page scoped dynamic CSS, automatic Markdown/Wiki alt text caption parsing, and 100% reliable PDF export—with zero layout conflicts.

---

## ✨ Features

- **⚡ 1-Click Floating Toolbar:** Hover over any image in Live Preview to align it Left, Center, or Right.
- **📝 Synchronized Captions:** Automatically parses and displays captions from Markdown alt text (e.g. `!["Wanderer above the Sea of Fog"|436](https://...)` or `![[image.png|My Caption|300]]`).
- **📐 Aligned Vertical Layout:** Stacks captions neatly underneath images matching their alignment (Left, Center, Right) without floating sideways or overlapping.
- **📍 Top-Left Positioning:** Floating toolbar sits neatly at the image's top-left corner, avoiding collisions with Obsidian's native embed controls.
- **🔒 Permanent Alignment:** Images in your notes stay aligned automatically from the moment you open the note.
- **📐 Native Resizing Preserved:** Full compatibility with Obsidian's size parameters (e.g. `|300`, `|200x150`) and corner drag-resizing handles.
- **📄 100% Reliable PDF Export:** Uses print-tested rules in `@media print` to guarantee that exported PDFs accurately retain image alignments and captions.
- **🚀 Active-Page Scoped Performance:** Dynamically scopes CSS generation strictly to the active note. Blazing fast performance with zero CSS bloat.
- **🎨 Theme Adaptive & Configurable:** Matches any theme with customizable caption styles (Italic/Normal) and alignment options in Settings.
- **🧹 Clean Markdown:** Stores alignment settings non-destructively in plugin data (`data.json`), keeping your raw markdown files clean.

---

## 🛠️ Installation

### Manual Installation
1. Download the latest release files (`main.js`, `manifest.json`, `styles.css`).
2. In your Obsidian vault, navigate to the plugins folder:
   ```
   <VaultFolder>/.obsidian/plugins/
   ```
3. Create a new folder named `image-align-caption`.
4. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
5. Open Obsidian, go to **Settings** > **Community plugins**, click the **Refresh** button, and enable **Image Align & Caption**.

---

## 📖 How to Use

1. **Align an Image:**
   - In **Live Preview**, hover your cursor over any image embed or link.
   - Click **Left**, **Center**, or **Right** on the top-left floating toolbar.
2. **Add Captions:**
   - **Wiki Links:** `![[image.png|My Caption|300]]`
   - **Markdown Links:** `!["Caspar David Friedrich"|436](https://example.com/image.jpg)`
   - The caption text will automatically render underneath the image matching the selected alignment.
3. **Reset / Remove Alignment:**
   - Click the currently active alignment button again to toggle it off and return to default alignment.
4. **Customize in Settings:**
   - Go to **Settings** > **Image Align & Caption** to customize caption visibility, font style (Italic/Normal), alignment preferences, and fallback filename captions.

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
