# Image Aligner

An Obsidian plugin to align images left, center, or right in both Reading View and Live Preview.

## Project Overview

Image Aligner provides a seamless way to control image alignment within Obsidian. It adds a floating hover panel to images in the Live Preview editor, allowing users to select alignment with a single click. The plugin ensures that these alignments are reflected in Reading View and are preserved when exporting to PDF.

### Key Features
- **Live Preview Integration:** Floating hover controls for quick alignment (exclusive to Live Preview mode).
- **Reading View Support:** Automatic alignment of images using Markdown post-processing.
- **PDF Export:** Preserves alignment in exported documents through dynamic CSS and print-specific rules.
- **Persistence:** Alignment settings are saved per image source using stable identifiers.
- **Native Support:** Respects Obsidian's native image resizing (e.g., `![[image.png|400]]`).

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
- **`main.js`**: The entry point of the plugin. It handles the `onload` and `onunload` lifecycles, registers events, manages data persistence, and controls the floating alignment panel.
- **`manifest.json`**: Contains plugin metadata such as ID, name, version, and description.
- **`styles.css`**: Defines the visual appearance of the floating panel and includes `@media print` rules for PDF export fallback.

### Implementation Details (v2.x)
- **Alignment Data:** Stored in a simple object mapping image identifiers to alignment directions (`left`, `center`, `right`). This data is persisted using Obsidian's `loadData` and `saveData` methods.
  - **Stable Keys:** The plugin uses a `link:` prefix (e.g., `link:image.png`) for internal links to ensure alignment persists even if the underlying `app://` resource URL changes.
  - **Data Migration:** The plugin automatically migrates old URL-based keys to the stable `link:` format on load.
- **Dynamic CSS:** The plugin injects a `<style id="ia-dynamic">` element into the document head to apply alignment styles dynamically.
  - **Aggressive Selectors:** Targets both the `img` tags and their wrapping containers (`.internal-embed`, `.image-embed`) to override theme defaults and ensure layout consistency.
  - **Live Preview Layout:** Uses `display: flex` and `justify-content` to handle alignment for Live Preview "block" embeds.
- **Floating Panel:** A `position: fixed` element created in `document.body` rather than inside the editor's DOM. This prevents CodeMirror 6 from destroying the panel during its frequent re-renders.
  - **Positioning:** Dynamically calculated based on the image's `getBoundingClientRect()` to stay glued to the top-right corner of the hovered image.
  - **Interaction:** Re-clicking an active alignment option removes the setting (toggles to null).
- **Markdown Post-processing:** In Reading View, images are processed to ensure the parent container (usually a `p` tag or similar) has the `.ia-host` class and alignment classes (e.g., `.ia-center`). This acts as a structural hook for the `@media print` rules in `styles.css`.
