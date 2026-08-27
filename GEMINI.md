# Image Aligner

An Obsidian plugin to align images left, center, or right in both Reading View and Live Preview.

## Project Overview

Image Aligner provides a seamless way to control image alignment within Obsidian. It adds a floating hover panel to images in the Live Preview editor, allowing users to select alignment with a single click. The plugin ensures that these alignments are reflected in Reading View and are preserved when exporting to PDF.

### Key Features
- **Live Preview Integration:** Single floating hover toolbar positioned at the top-left corner for quick alignment without colliding with Obsidian's native embed controls.
- **Reading View Support:** Automatic alignment of images using Markdown post-processing.
- **100% Reliable PDF Export:** Preserves alignment in exported documents through print-specific block and margin rules.
- **Active-Page Scoped CSS (v2.3):** Generates CSS *only* for images in the currently active note(s). Zero performance overhead even if the vault contains 10k+ images.
- **Permanent Sizing & Resizing:** Preserves native sizing (`|300`, `|200x100`, or corner drag-resizing).
- **Theme Adaptive:** Uses Obsidian CSS variables to blend natively with any light or dark community theme.

### Technologies
- **JavaScript:** Core plugin logic (Vanilla JS).
- **Obsidian API:** Integration with the Obsidian workspace, editor, and data storage.
- **CSS:** UI styling, static layout classes, and print-specific rules.

## Building and Running

This project is a vanilla JavaScript Obsidian plugin and does not require a build step.

### Installation
1.  Navigate to your Obsidian vault's plugins directory: `.obsidian/plugins/`.
2.  Create a new folder named `image-aligner-thesiddikhamim`.
3.  Copy the following files into the `image-aligner-thesiddikhamim` folder:
    - `main.js`
    - `manifest.json`
    - `styles.css`
4.  Open Obsidian and go to `Settings` > `Community plugins`.
5.  Click the "Refresh" icon and then enable "Image Aligner".

### Development Workflow
- **Manual Reload:** Disable and re-enable the plugin in Obsidian's settings to apply changes made to the files.
- **Hot Reload:** Use the [Obsidian Hot Reload](https://github.com/pjeby/hot-reload) plugin for a smoother development experience.
- **Debugging:** Open the Obsidian developer tools (`Cmd+Option+I` on macOS or `Ctrl+Shift+I` on Windows/Linux) to view console logs and inspect the DOM.

## Development Conventions

### Code Structure
- **`main.js`**: The entry point of the plugin. Handles `onload`/`onunload` lifecycles, data persistence, active note image discovery, and controls the floating alignment toolbar.
- **`manifest.json`**: Contains plugin metadata such as ID, name, version, and description.
- **`styles.css`**: Defines static layout classes, floating toolbar styling (theme-adaptive), and `@media print` rules for PDF export.

### Implementation Details (v2.3)
- **Active-Page Scoped CSS:** Only compiles CSS rules for images present in active leaves. Switching notes dynamically swaps the active rules in `<style id="ia-dynamic">`.
- **Permanent Layout:** All images on an open note are aligned from the moment the note opens; no hovering required, and leaving the cursor will not unalign.
- **Single Managed Floating Panel:** A single `position: fixed` element created in `document.body` positioned at the top-left of the hovered image.
- **Print Specificity:** Uses print-tested block margins during PDF export to guarantee accurate PDF print output across all Chromium/Electron print modes.
