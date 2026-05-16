'use strict';

/* ============================================================
   Image Aligner — Obsidian Plugin  v2.0
   ─────────────────────────────────────────────────────────
   • Hover controls appear ONLY in Live Preview mode
   • Alignment is stored and reflected everywhere:
       – Live Preview  (dynamic CSS via <style> in <head>)
       – Reading Mode  (same CSS + wrapper class for print)
       – Print / PDF   (CSS persists; panel is hidden by print rule)
   • Respects Obsidian's native resize (|400 etc.)
   ============================================================ */

const { Plugin, MarkdownView } = require('obsidian');

// ── SVG icons (Lucide-style text-align icons) ─────────────────
const ICONS = {
    left: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
             <line x1="3" y1="6"  x2="21" y2="6"/>
             <line x1="3" y1="10" x2="15" y2="10"/>
             <line x1="3" y1="14" x2="21" y2="14"/>
             <line x1="3" y1="18" x2="15" y2="18"/>
           </svg>`,
    center: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
               <line x1="3" y1="6"  x2="21" y2="6"/>
               <line x1="6" y1="10" x2="18" y2="10"/>
               <line x1="3" y1="14" x2="21" y2="14"/>
               <line x1="6" y1="18" x2="18" y2="18"/>
             </svg>`,
    right:  `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
               <line x1="3" y1="6"  x2="21" y2="6"/>
               <line x1="9" y1="10" x2="21" y2="10"/>
               <line x1="3" y1="14" x2="21" y2="14"/>
               <line x1="9" y1="18" x2="21" y2="18"/>
             </svg>`,
};

const DIRS   = ['left', 'center', 'right'];
const MARGIN = { left: '0 auto 0 0', center: '0 auto', right: '0 0 0 auto' };

// ─────────────────────────────────────────────────────────────
class ImageAlignerPlugin extends Plugin {

    data        = { alignments: {} };  // { [imgSrc]: 'left'|'center'|'right' }
    styleEl     = null;                // <style id="ia-dynamic"> in <head>

    // editorEl → { panel: HTMLElement, removeFn: () => void }
    editorSetups = new Map();

    // ── Lifecycle ─────────────────────────────────────────────
    async onload() {
        await this._loadData();
        this._migrateData();

        // ① Dynamic <style> for alignment — rebuilt from saved data on every
        //    load, so it is present even during PDF export (Obsidian re-runs
        //    plugins when it renders the export view).
        this.styleEl = document.createElement('style');
        this.styleEl.id = 'ia-dynamic';
        document.head.appendChild(this.styleEl);
        this._rebuildCSS();

        // ② Reading mode post-processor — applies wrapper class so the
        //    @media print rules in styles.css have a reliable hook.
        //    Does NOT add any hover controls.
        this.registerMarkdownPostProcessor((el) => this._postProcess(el));

        // ③ Live Preview: attach floating panel to each editor leaf.
        this._initAllLeaves();
        this.registerEvent(
            this.app.workspace.on('layout-change',      () => this._initAllLeaves())
        );
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => this._initAllLeaves())
        );

        console.log('[Image Aligner] v2.1 loaded');
    }

    onunload() {
        this.styleEl?.remove();
        this.editorSetups.forEach(({ panel, removeFn }) => {
            removeFn();
            panel.remove();
        });
        this.editorSetups.clear();
        // Safety sweep for any orphaned panels
        document.querySelectorAll('.ia-float-panel').forEach(el => el.remove());
    }

    // ── Persistence ───────────────────────────────────────────
    async _loadData() {
        const saved = await this.loadData();
        this.data = Object.assign({ alignments: {} }, saved);
        if (!this.data.alignments) this.data.alignments = {};
    }
    async _saveData() { await this.saveData(this.data); }

    // Aggressively migrate old keys to the new stable format.
    _migrateData() {
        let changed = false;
        const clean = {};
        for (let [src, align] of Object.entries(this.data.alignments)) {
            let newKey = src;
            
            // 1. Convert app:// or file:// URLs to simple link keys (best effort)
            if (src.startsWith('app://') || src.startsWith('file://')) {
                try {
                    const url = new URL(src);
                    const pathParts = url.pathname.split('/');
                    const filename = pathParts.pop();
                    if (filename) {
                        newKey = 'link:' + decodeURIComponent(filename);
                        changed = true;
                    }
                } catch (e) {
                    // Fallback for non-standard URLs
                    const parts = src.split('?')[0].split('/');
                    const filename = parts.pop();
                    if (filename) {
                        newKey = 'link:' + decodeURIComponent(filename);
                        changed = true;
                    }
                }
            } 
            // 2. Wrap existing raw filenames in 'link:' prefix
            else if (!src.startsWith('link:') && !src.startsWith('file:') && !src.startsWith('http')) {
                newKey = 'link:' + src;
                changed = true;
            }

            // 3. Strip any remaining query params
            if (newKey.includes('?')) {
                newKey = newKey.split('?')[0];
                changed = true;
            }
            
            clean[newKey] = align;
        }
        if (changed) {
            this.data.alignments = clean;
            this._saveData();
        }
    }

    // ── Stable image key ──────────────────────────────────────
    // We prioritize the internal link path (e.g., "image.png") over the
    // volatile app:// resource path. This ensures persistence across restarts.
    _key(img) {
        // 1. Internal Link (Wiki-link ![[...]] or Markdown link)
        const embed = img.closest('.internal-embed');
        if (embed) {
            let src = embed.getAttribute('src');
            if (src) {
                // Strip size/alt: "image.png|400" -> "image.png"
                if (src.includes('|')) src = src.split('|')[0];
                return 'link:' + src;
            }
        }

        // 2. Reading Mode data-path attribute
        const path = img.getAttribute('data-path');
        if (path) return 'link:' + path;

        // 3. External URL or fallback
        let src = img.getAttribute('src') || '';
        if (src.includes('?')) src = src.split('?')[0];
        
        // If it's a web URL, return as is. If app://, we've already failed to find a better key.
        return src;
    }

    // ── Dynamic CSS ───────────────────────────────────────────
    // Multi-layered selectors to ensure alignment works in all modes.
    _rebuildCSS() {
        if (!this.styleEl) return;
        const lines = [];

        for (const [key, align] of Object.entries(this.data.alignments)) {
            const marginValue = MARGIN[align];
            const textAlign   = align === 'center' ? 'center' : (align === 'right' ? 'right' : 'left');

            if (key.startsWith('link:')) {
                const path = key.substring(5);
                const safePath = path.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                const filename = path.split('/').pop().replace(/"/g, '\\"');

                // A. Target the internal-embed container (Reading & LP)
                // We use ^= to handle "image.png|400" cases
                lines.push(`.internal-embed[src^="${safePath}"] { display: block !important; text-align: ${textAlign} !important; margin: ${marginValue} !important; }`);
                lines.push(`.internal-embed[src^="${safePath}"] img { display: block !important; margin: ${marginValue} !important; }`);
                
                // B. Target by data-path (Reading Mode)
                lines.push(`img[data-path="${safePath}"] { display: block !important; margin: ${marginValue} !important; }`);

                // C. Target by partial src match (Live Preview robust fallback)
                // This catches the app://.../filename.png URLs in the editor
                lines.push(`.markdown-source-view.mod-cm6 .cm-content img[src*="${filename}"] { display: block !important; margin: ${marginValue} !important; }`);
                lines.push(`.markdown-source-view.mod-cm6 .cm-content img[alt="${filename}"] { display: block !important; margin: ${marginValue} !important; }`);
            } else {
                // External URLs
                const safe = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                lines.push(`img[src^="${safe}"] { display: block !important; margin: ${marginValue} !important; }`);
                lines.push(`img[src*="${safe}"] { display: block !important; margin: ${marginValue} !important; }`);
            }
        }

        // Keep the floating panel out of any print / PDF output
        lines.push('@media print { .ia-float-panel { display:none !important; } }');

        this.styleEl.textContent = lines.join('\n');
    }

    // ── Reading mode post-processor ───────────────────────────
    // Adds .ia-host + .ia-{align} to the wrapping element so that
    // styles.css @media print rules have a class-based fallback.
    // Dynamic CSS already handles the visual; this is purely for print safety.
    _postProcess(el) {
        el.querySelectorAll('img').forEach(img => {
            const key   = this._key(img);
            const align = this.data.alignments[key] || null;
            const host  = img.closest('p') || img.parentElement;
            if (!host) return;

            host.classList.add('ia-host');
            DIRS.forEach(d => host.classList.remove('ia-' + d));
            if (align) host.classList.add('ia-' + align);
        });
    }

    // ── Live Preview — init all leaves ────────────────────────
    _initAllLeaves() {
        this.app.workspace.iterateAllLeaves(leaf => {
            if (!(leaf.view instanceof MarkdownView)) return;
            // 'source' covers both Live Preview and pure source mode.
            // In pure source mode no <img> elements are in the DOM,
            // so the hover listener is effectively inert.
            if (leaf.view.getMode() !== 'source') return;

            const editorEl = leaf.view.contentEl;
            if (!editorEl || this.editorSetups.has(editorEl)) return;

            this._setupEditor(editorEl);
        });
    }

    // ── Floating panel for one editor pane ───────────────────
    // The panel lives in document.body (outside CM6's DOM) so that
    // CM's internal re-renders never destroy it.
    _setupEditor(editorEl) {
        const panel = document.createElement('div');
        panel.className = 'ia-float-panel';
        document.body.appendChild(panel);

        let activeImg = null;
        let hideTimer = null;

        // ── Populate panel with buttons for the hovered image ─
        const populate = (img) => {
            panel.innerHTML = '';
            const key   = this._key(img);
            const saved = this.data.alignments[key] || null;

            DIRS.forEach(dir => {
                const btn = document.createElement('button');
                btn.className   = 'ia-btn' + (saved === dir ? ' ia-on' : '');
                btn.title       = 'Align ' + dir[0].toUpperCase() + dir.slice(1);
                btn.dataset.dir = dir;
                btn.innerHTML   = ICONS[dir];

                btn.addEventListener('mousedown', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const cur  = this.data.alignments[key] || null;
                    const next = cur === dir ? null : dir; // re-click = remove

                    // Update button visuals immediately
                    panel.querySelectorAll('.ia-btn').forEach(b => {
                        b.classList.toggle('ia-on', b.dataset.dir === next);
                    });

                    // Persist
                    if (next) this.data.alignments[key] = next;
                    else      delete this.data.alignments[key];

                    await this._saveData();
                    this._rebuildCSS();           // → instant everywhere
                    this._refreshReadingViews();  // → re-render reading panes
                });

                panel.appendChild(btn);
            });
        };

        // ── Position panel at top-right corner of image ───────
        const reposition = (img) => {
            const r             = img.getBoundingClientRect();
            panel.style.top     = (r.top  + 8) + 'px';
            panel.style.right   = (window.innerWidth - r.right + 8) + 'px';
            panel.style.left    = 'auto';
        };

        const showPanel = (img) => {
            clearTimeout(hideTimer);
            if (activeImg === img && panel.style.display !== 'none') return;
            activeImg = img;
            populate(img);
            reposition(img);
            panel.style.display = 'flex';
        };

        const hidePanel = (delay = 180) => {
            hideTimer = setTimeout(() => {
                panel.style.display = 'none';
                activeImg = null;
            }, delay);
        };

        // ── Event listeners on the editor element ─────────────
        const onMouseOver = (e) => {
            if (!(e.target instanceof HTMLImageElement)) return;
            if (!editorEl.contains(e.target)) return;
            showPanel(e.target);
        };

        const onMouseOut = (e) => {
            if (e.target !== activeImg) return;
            // Moving into the panel itself? Keep it visible.
            if (e.relatedTarget && panel.contains(e.relatedTarget)) return;
            hidePanel();
        };

        // Keep panel glued to the image while the editor scrolls
        const onScroll = () => {
            if (activeImg && panel.style.display !== 'none') reposition(activeImg);
        };

        editorEl.addEventListener('mouseover', onMouseOver);
        editorEl.addEventListener('mouseout',  onMouseOut);
        editorEl.addEventListener('scroll', onScroll, { capture: true, passive: true });

        // Panel itself — keep open while hovered, hide when left
        panel.addEventListener('mouseenter', () => clearTimeout(hideTimer));
        panel.addEventListener('mouseleave', () => hidePanel());

        // Store references for cleanup on unload
        const removeFn = () => {
            editorEl.removeEventListener('mouseover', onMouseOver);
            editorEl.removeEventListener('mouseout',  onMouseOut);
            editorEl.removeEventListener('scroll', onScroll, { capture: true });
        };

        this.editorSetups.set(editorEl, { panel, removeFn });
    }

    // ── Refresh open reading-mode panes after a change ────────
    _refreshReadingViews() {
        this.app.workspace.iterateAllLeaves(leaf => {
            if (!(leaf.view instanceof MarkdownView)) return;
            if (leaf.view.getMode() !== 'preview') return;
            try { leaf.view.previewMode.rerender(true); } catch (_) {}
        });
    }
}

module.exports = ImageAlignerPlugin;
