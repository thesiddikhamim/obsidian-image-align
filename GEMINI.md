# Image Aligner

An Obsidian plugin to align images left, center, or right in both Reading View and Live Preview.

## Project Overview

Image Aligner provides a seamless way to control image alignment within Obsidian. It adds a floating hover panel to images in the Live Preview editor, allowing users to select alignment with a single click. The plugin ensures that these alignments are reflected in Reading View and are preserved when exporting to PDF.

### Key Features
- **Live Preview Integration:** Single floating hover toolbar for quick alignment (exclusive to Live Preview mode).
- **Reading View Support:** Automatic alignment of images using Markdown post-processing.
- **PDF Export:** Preserves alignment in exported documents through dynamic CSS and print-specific rules.
- **Persistence & Precision:** Alignment settings are saved per image source using stable, collision-free identifiers.
- **Native Support:** Respects Obsidian's native image resizing (e.g., `![[image.png|400]]`).
- **Theme Adaptive:** Uses Obsidian CSS variables to blend natively with any light or dark community theme.

### Technologies
- **JavaScript:** Core plugin logic (Vanilla JS).
- **Obsidian API:** Integration with the Obsidian workspace, editor, and data storage.
- **CSS:** UI styling, dynamic layout injection, and print-specific rules.

## Building and Running

This project is a vanilla JavaScript Obsidian plugin and does not require a build step.

### Installation
1.  Navigate to your Obsidian vault's plugins directory: `.obsidian/plugins/`.
2.  Create a new folder named `image-aligner`.
3.  Copy the following files into the `image-aligner` folder:
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
- **`main.js`**: The entry point of the plugin. Handles `onload`/`onunload` lifecycles, manages data persistence, injects dynamic layout rules, and controls the single floating alignment toolbar.
- **`manifest.json`**: Contains plugin metadata such as ID, name, version, and description.
- **`styles.css`**: Defines the visual appearance of the floating toolbar (using Obsidian CSS theme variables) and includes `@media print` rules for PDF export fallback.

### Implementation Details (v2.1)
- **Alignment Data:** Stored in a simple object mapping image identifiers to alignment directions (`left`, `center`, `right`). Persisted using Obsidian's `loadData` and `saveData` methods.
  - **Stable Keys:** Uses `link:` prefix (e.g., `link:image.png` or `link:folder/image.png`) for internal links.
  - **Collision-Safe Matching:** Selectors strictly check filename boundaries (`[src*="/image.png?"]`, `[src^="image.png|"]`, `[src="image.png"]`) to avoid false-positive matches (e.g., `cat.png` matching `black-cat.png`).
- **Dynamic CSS:** Injects a `<style id="ia-dynamic">` element into the document head to apply alignment styles dynamically.
  - **Live Preview & Reading View Layout:** Uses `display: flex` and `justify-content` on embed wrappers and `display: block` with margins on `img` elements.
- **Single Managed Floating Panel:** A single `position: fixed` element created in `document.body`. Eliminates DOM and memory leaks across tab switches and leaves.
  - **Instant Repositioning:** Immediately recalculates toolbar coordinates on click via `requestAnimationFrame` when the image shifts position.
  - **Native Tooltips:** Uses `aria-label` for smooth, native Obsidian tooltips.
- **Markdown Post-processing:** In Reading View, images are processed to ensure the parent container has `.ia-host` and `.ia-{align}` classes for print and layout fallbacks.
