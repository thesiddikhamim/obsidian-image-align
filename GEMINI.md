# Image Aligner

An Obsidian plugin to align images left, center, or right in both Reading View and Live Preview.

## Project Overview

**Image Aligner** provides a seamless, non-destructive way to align images within Obsidian. It introduces a lightweight floating hover toolbar at the top-left of images in Live Preview, allowing one-click alignment (Left, Center, Right). Alignments are displayed permanently across all notes, preserved in Reading View, and fully retained during PDF export.

### Key Features
- **Active-Page Scoped CSS (v2.3):** Dynamically generates CSS *strictly* for images in the currently active note(s). Zero memory or CSS bloat even if the vault contains 10,000+ images.
- **Permanent, Hover-Free Alignment:** Every image on open notes is rendered with its alignment immediately. Moving your cursor away never unaligns or flickers.
- **Native Sizing & Resizing Support:** Fully preserves custom sizing attributes (`|300`, `|200x100`) and Obsidian's corner drag-resizing handles without stretching images to 100% width.
- **Top-Left Floating Panel:** Positioned at the image's top-left corner to avoid colliding with Obsidian's native embed controls in the top-right corner.
- **100% Reliable PDF Export:** Uses print-tested block and margin rules in `@media print` ensuring exported PDFs match on-screen layout.
- **Theme Adaptive:** Uses standard Obsidian CSS variables to blend natively with any light or dark community theme and custom accent colors.
- **Non-Destructive Storage:** Saves alignments in `data.json` so raw Markdown notes stay clean and uncluttered.

### Technologies
- **JavaScript (ES6 / Vanilla JS):** Core plugin lifecycle, event delegation, active note image extraction, and toolbar management.
- **Obsidian API:** Integration with workspace leaves, markdown post-processors, and persistent data storage.
- **CSS:** UI styling, glassmorphism toolbar, static layout rules, and `@media print` fallback definitions.

## Building and Running

This project is a vanilla JavaScript Obsidian plugin and does not require a build step or bundler.

### Installation
1.  Navigate to your Obsidian vault plugins directory: `.obsidian/plugins/`.
2.  Create a new folder named `image-aligner-thesiddikhamim`.
3.  Copy the following files into the `image-aligner-thesiddikhamim` folder:
    - `main.js`
    - `manifest.json`
    - `styles.css`
4.  Open Obsidian and go to `Settings` > `Community plugins`.
5.  Click the "Refresh" icon and enable **Image Aligner**.

### Development Workflow
- **Manual Reload:** Disable and re-enable the plugin in Obsidian's settings or use `Cmd+R` / `Ctrl+R` to reload Obsidian.
- **Hot Reload:** Compatible with the [Obsidian Hot Reload](https://github.com/pjeby/hot-reload) plugin.
- **Debugging:** Open Developer Tools (`Cmd+Option+I` on macOS or `Ctrl+Shift+I` on Windows/Linux) to view console logs and inspect DOM elements.

## Development Conventions

### Code Structure
- **`main.js`**: Plugin entry point. Handles `onload`/`onunload` lifecycles, data persistence, active note image parsing (`_getActiveImageKeys`), scoped dynamic CSS compilation (`_rebuildCSS`), and single floating toolbar management.
- **`manifest.json`**: Plugin metadata (ID: `image-aligner-thesiddikhamim`, version, author, description).
- **`styles.css`**: Theme-adaptive toolbar styles, layout rules for line containers/embeds, and `@media print` rules for PDF export.

### Implementation Details (v2.3)
- **Active-Page Scoped CSS:** Only compiles CSS rules for images discovered in active leaves (via editor text parsing + rendered DOM scan). Switching notes instantly rebuilds `<style id="ia-dynamic">`.
- **Permanent Layout:** Alignment is driven by the browser's CSS matching engine, eliminating race conditions with CodeMirror 6's virtual scrolling.
- **Single Managed Floating Panel:** A single `position: fixed` element appended to `document.body`, repositioned on hover and alignment changes using `requestAnimationFrame`.
- **Print Specificity:** Uses print-tested block margins during PDF export to guarantee accurate PDF print output across all Chromium/Electron print modes.
