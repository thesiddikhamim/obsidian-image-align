# Image Align & Caption

An Obsidian plugin to align images (left, center, or right) and display synchronized captions in both Reading View and Live Preview.

## Project Overview

**Image Align & Caption** provides a seamless, non-destructive way to align images and render captions within Obsidian. It introduces a lightweight floating hover toolbar at the top-left of images in Live Preview, allowing one-click alignment (Left, Center, Right). Alignments and captions are displayed permanently across all notes, preserved in Reading View, and fully retained during PDF export without horizontal layout collisions.

### Key Features
- **Unified Alignment & Captions (v3.0):** Images and captions are rendered as a synchronized vertical unit (column layout). Left image = left caption; Center image = center caption; Right image = right caption.
- **Active-Page Scoped CSS:** Dynamically generates CSS *strictly* for images in the currently active note(s). Zero memory or CSS bloat even if the vault contains 10,000+ images.
- **Permanent, Hover-Free Alignment:** Every image on open notes is rendered with its alignment immediately. Moving your cursor away never unaligns or flickers.
- **Native Sizing & Resizing Support:** Fully preserves custom sizing attributes (`|300`, `|200x100`) and Obsidian's corner drag-resizing handles without stretching images to 100% width.
- **Top-Left Floating Panel:** Positioned at the image's top-left corner to avoid colliding with Obsidian's native embed controls in the top-right corner.
- **100% Reliable PDF Export:** Uses print-tested block and margin rules in `@media print` ensuring exported PDFs match on-screen layout.
- **Theme Adaptive & Configurable:** Uses standard Obsidian CSS variables and includes a settings tab for caption styles and alignment preferences.
- **Non-Destructive Storage:** Saves alignments in `data.json` so raw Markdown notes stay clean and uncluttered.

### Technologies
- **JavaScript (ES6 / Vanilla JS):** Core plugin lifecycle, event delegation, active note image extraction, caption parsing, and toolbar management.
- **Obsidian API:** Integration with workspace leaves, markdown post-processors, settings tab, and persistent data storage.
- **CSS:** UI styling, glassmorphism toolbar, static layout rules, caption typography, and `@media print` fallback definitions.

## Building and Running

This project is a vanilla JavaScript Obsidian plugin and does not require a build step or bundler.

### Installation
1.  Navigate to your Obsidian vault plugins directory: `.obsidian/plugins/`.
2.  Create a new folder named `image-align-caption`.
3.  Copy the following files into the `image-align-caption` folder:
    - `main.js`
    - `manifest.json`
    - `styles.css`
4.  Open Obsidian and go to `Settings` > `Community plugins`.
5.  Click the "Refresh" icon and enable **Image Align & Caption**.

### Development Workflow
- **Manual Reload:** Disable and re-enable the plugin in Obsidian's settings or use `Cmd+R` / `Ctrl+R` to reload Obsidian.
- **Hot Reload:** Compatible with the [Obsidian Hot Reload](https://github.com/pjeby/hot-reload) plugin.
- **Debugging:** Open Developer Tools (`Cmd+Option+I` on macOS or `Ctrl+Shift+I` on Windows/Linux) to view console logs and inspect DOM elements.

## Development Conventions

### Code Structure
- **`main.js`**: Plugin entry point. Handles `onload`/`onunload` lifecycles, settings & data persistence, caption parsing (`parseCaption`), active note image parsing (`_getActiveImageKeys`), scoped dynamic CSS compilation (`_rebuildCSS`), live preview DOM observation, reading mode post-processing, and single floating toolbar management.
- **`manifest.json`**: Plugin metadata (ID: `image-align-caption`, version `3.0.0`, author, description).
- **`styles.css`**: Theme-adaptive toolbar styles, vertical column layout rules for line containers/embeds, caption typography, and `@media print` rules for PDF export.

