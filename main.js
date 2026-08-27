'use strict';

/* ============================================================
   Image Aligner — Obsidian Plugin v2.3
   ─────────────────────────────────────────────────────────
   • Active-Page Scoped Dynamic CSS: Generates CSS ONLY for
     images in currently active notes (zero bloat from 10k vault images).
   • Permanent styling: All images on active note are aligned
     automatically without needing to hover.
   • Resizing support: Preserves |300, |200x100 and drag handles.
   • 1-Click floating toolbar at image top-left (Live Preview).
   • 100% reliable PDF export support via Markdown Post-Processor.
   ============================================================ */

const { Plugin, MarkdownView } = require('obsidian');

// ── SVG Icons ────────────────────────────────────────────────
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

const DIRS = ['left', 'center', 'right'];

function escapeCSS(str) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(str);
    }
    return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

class ImageAlignerPlugin extends Plugin {

    data         = { alignments: {} }; // { [key]: 'left'|'center'|'right' }
    styleEl      = null;               // <style id="ia-dynamic"> for active-page CSS
    panel        = null;               // Single shared floating toolbar
    activeImg    = null;               // Currently hovered <img>
    hideTimer    = null;               // Panel hide timer
    rebuildTimer = null;               // Debounce timer for active note CSS rebuild

    // ── Lifecycle ─────────────────────────────────────────────
    async onload() {
        await this._loadData();
        this._migrateData();

        // ① Active-Page Dynamic <style>
        this.styleEl = document.createElement('style');
        this.styleEl.id = 'ia-dynamic';
        document.head.appendChild(this.styleEl);
        this._rebuildCSS();

        // ② Reading View & PDF Export post-processor
        this.registerMarkdownPostProcessor((el) => this._postProcess(el));

        // ③ Single shared floating alignment toolbar (top-left)
        this._initFloatingPanel();

        // ④ Global delegated events
        this.registerDomEvent(document, 'mouseover', (e) => this._onMouseOver(e));
        this.registerDomEvent(document, 'mouseout',  (e) => this._onMouseOut(e));
        this.registerDomEvent(window,   'scroll',    () => this._onScroll(), { capture: true, passive: true });
        this.registerDomEvent(window,   'resize',    () => this._onResize(), { passive: true });

        // ⑤ Active page change listeners — rebuilds CSS strictly for open notes
        this.registerEvent(this.app.workspace.on('active-leaf-change', () => this._debouncedRebuild()));
        this.registerEvent(this.app.workspace.on('layout-change',      () => this._debouncedRebuild()));
        this.registerEvent(this.app.workspace.on('editor-change',      () => this._debouncedRebuild()));

        console.log('[Image Aligner] v2.3 loaded (Active-Page Scoped)');
    }

    onunload() {
        if (this.hideTimer) clearTimeout(this.hideTimer);
        if (this.rebuildTimer) clearTimeout(this.rebuildTimer);

        this.styleEl?.remove();
        this.panel?.remove();
        this.panel = null;
        this.activeImg = null;

        document.querySelectorAll('.ia-float-panel').forEach(el => el.remove());
    }

    _debouncedRebuild() {
        if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
        this.rebuildTimer = setTimeout(() => {
            this._rebuildCSS();
        }, 120);
    }

    // ── Persistence ───────────────────────────────────────────
    async _loadData() {
        const saved = await this.loadData();
        this.data = Object.assign({ alignments: {} }, saved);
        if (!this.data.alignments) this.data.alignments = {};
    }

    async _saveData() {
        await this.saveData(this.data);
    }

    _migrateData() {
        let changed = false;
        const clean = {};
        for (let [src, align] of Object.entries(this.data.alignments)) {
            let newKey = src;

            if (src.startsWith('app://') || src.startsWith('file://')) {
                try {
                    const url = new URL(src);
                    const pathParts = url.pathname.split('/');
                    const filename = pathParts.pop();
                    if (filename) {
                        newKey = 'link:' + decodeURIComponent(filename);
                        changed = true;
                    }
                } catch (_) {
                    const parts = src.split('?')[0].split('/');
                    const filename = parts.pop();
                    if (filename) {
                        newKey = 'link:' + decodeURIComponent(filename);
                        changed = true;
                    }
                }
            } else if (!src.startsWith('link:') && !src.startsWith('file:') && !src.startsWith('http://') && !src.startsWith('https://')) {
                newKey = 'link:' + src;
                changed = true;
            }

            if (newKey.startsWith('link:http://') || newKey.startsWith('link:https://')) {
                newKey = newKey.replace(/^link:/, '');
                changed = true;
            }

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
    _key(img) {
        if (!img) return '';

        // 1. Internal Link (Wiki-link ![[...]] or Markdown embed)
        const embed = img.closest('.internal-embed') || img.closest('.image-embed');
        if (embed) {
            let src = embed.getAttribute('src');
            if (src) {
                if (src.includes('?')) src = src.split('?')[0];
                if (src.includes('|')) src = src.split('|')[0];
                src = src.trim();
                return (src.startsWith('http://') || src.startsWith('https://')) ? src : ('link:' + src);
            }
        }

        // 2. Reading Mode data-path attribute
        const path = img.getAttribute('data-path');
        if (path) return 'link:' + path.trim();

        // 3. Fallback / external URL
        let src = img.getAttribute('src') || '';
        if (src.includes('?')) src = src.split('?')[0];

        if (src.startsWith('app://') || src.startsWith('file://')) {
            try {
                const url = new URL(src);
                const filename = url.pathname.split('/').pop();
                if (filename) return 'link:' + decodeURIComponent(filename);
            } catch (_) {
                const filename = src.split('/').pop();
                if (filename) return 'link:' + decodeURIComponent(filename);
            }
        }

        return src;
    }

    // ── Extract only images present on the currently active note(s) ──
    _getActiveImageKeys() {
        const keys = new Set();

        this.app.workspace.iterateAllLeaves(leaf => {
            if (!(leaf.view instanceof MarkdownView)) return;

            // 1. Parse text from open markdown editor
            try {
                const text = leaf.view.editor ? leaf.view.editor.getValue() : '';
                if (text) {
                    // Wiki links: ![[image.png|300]]
                    const wikiRegex = /!\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
                    let match;
                    while ((match = wikiRegex.exec(text)) !== null) {
                        const path = match[1].trim();
                        if (path) {
                            keys.add('link:' + path);
                            const filename = path.split('/').pop();
                            if (filename) keys.add('link:' + filename);
                        }
                    }

                    // Markdown links: ![alt](url)
                    const mdRegex = /!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
                    while ((match = mdRegex.exec(text)) !== null) {
                        let rawUrl = match[1].trim();
                        if (rawUrl.includes('?')) rawUrl = rawUrl.split('?')[0];
                        if (rawUrl) {
                            if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
                                keys.add(rawUrl);
                            } else {
                                keys.add('link:' + rawUrl);
                                const fn = rawUrl.split('/').pop();
                                if (fn) keys.add('link:' + fn);
                            }
                        }
                    }
                }
            } catch (_) {}

            // 2. Scan rendered DOM in open leaf (catches HTML <img>, canvas embeds, etc.)
            try {
                if (leaf.view.contentEl) {
                    const imgs = leaf.view.contentEl.querySelectorAll('img');
                    imgs.forEach(img => {
                        const k = this._key(img);
                        if (k) keys.add(k);
                    });
                }
            } catch (_) {}
        });

        return keys;
    }

    // ── Active-Page Scoped Dynamic CSS ────────────────────────
    _rebuildCSS() {
        if (!this.styleEl) return;

        const activeKeys = this._getActiveImageKeys();
        const lines = [];

        // Build CSS rules ONLY for images currently present on the active note(s)
        for (const [key, align] of Object.entries(this.data.alignments)) {
            if (!DIRS.includes(align)) continue;

            // Check if key belongs to an active image in the open note
            let isRelevant = false;
            if (activeKeys.has(key)) {
                isRelevant = true;
            } else {
                for (const activeKey of activeKeys) {
                    if (
                        activeKey === key ||
                        activeKey.endsWith('/' + key.replace(/^link:/, '')) ||
                        key.endsWith('/' + activeKey.replace(/^link:/, ''))
                    ) {
                        isRelevant = true;
                        break;
                    }
                }
            }

            // Skip generating CSS for images not in the active note(s)
            if (!isRelevant) continue;

            const isLink = key.startsWith('link:');
            const rawPath = isLink ? key.substring(5).trim() : key.trim();
            const filename = rawPath.split('/').pop().split('?')[0];

            const safeRaw = escapeCSS(rawPath);
            const safeFile = escapeCSS(filename);
            const encFile = escapeCSS(encodeURIComponent(filename));

            const justifyVal = align === 'center' ? 'center' : (align === 'right' ? 'flex-end' : 'flex-start');
            const textAlign  = align === 'center' ? 'center' : (align === 'right' ? 'right' : 'left');

            if (isLink) {
                // Line & paragraph containers
                lines.push(`
.markdown-source-view.mod-cm6 .cm-embed-block:has(.internal-embed[src*="${safeFile}"]),
.markdown-source-view.mod-cm6 .cm-embed-block:has(.image-embed[src*="${safeFile}"]),
.markdown-source-view.mod-cm6 .cm-line:has(.internal-embed[src*="${safeFile}"]),
.markdown-rendered p:has(.internal-embed[src*="${safeFile}"]),
.markdown-rendered p:has(img[data-path*="${safeFile}"]),
.markdown-rendered p:has(img[src*="${safeFile}"]) {
    display: flex !important;
    justify-content: ${justifyVal} !important;
    text-align: ${textAlign} !important;
}`);

                // Embed wrapper (inline-flex, preserves resizing |300)
                lines.push(`
.internal-embed[src*="${safeFile}"],
.image-embed[src*="${safeFile}"],
.internal-embed[src^="${safeRaw}|"],
.internal-embed[src="${safeRaw}"] {
    display: inline-flex !important;
    justify-content: ${justifyVal} !important;
    margin-left: ${align === 'left' ? '0' : 'auto'} !important;
    margin-right: ${align === 'right' ? '0' : 'auto'} !important;
    max-width: 100% !important;
}`);

                // Direct image element
                lines.push(`
img[src*="/${encFile}?"],
img[src$="/${encFile}"],
img[src*="/${safeFile}?"],
img[src$="/${safeFile}"],
img[data-path*="${safeFile}"],
.internal-embed[src*="${safeFile}"] img,
.image-embed[src*="${safeFile}"] img {
    display: block !important;
    margin-left: ${align === 'left' ? '0' : 'auto'} !important;
    margin-right: ${align === 'right' ? '0' : 'auto'} !important;
    max-width: 100% !important;
}`);
            } else {
                // External web image
                const safeKey = escapeCSS(rawPath);
                lines.push(`
.markdown-source-view.mod-cm6 .cm-embed-block:has(img[src^="${safeKey}"]),
.markdown-source-view.mod-cm6 .cm-embed-block:has(img[src*="${safeKey}"]),
.markdown-source-view.mod-cm6 .cm-line:has(img[src^="${safeKey}"]),
.markdown-source-view.mod-cm6 .cm-line:has(img[src*="${safeKey}"]),
.markdown-source-view.mod-cm6 .image-embed[src^="${safeKey}"],
.markdown-source-view.mod-cm6 .image-embed:has(img[src^="${safeKey}"]),
.markdown-rendered p:has(img[src^="${safeKey}"]),
.markdown-rendered p:has(img[src*="${safeKey}"]) {
    display: flex !important;
    justify-content: ${justifyVal} !important;
    text-align: ${textAlign} !important;
}
.image-embed[src^="${safeKey}"],
.image-embed:has(img[src^="${safeKey}"]) {
    display: inline-flex !important;
    justify-content: ${justifyVal} !important;
    margin-left: ${align === 'left' ? '0' : 'auto'} !important;
    margin-right: ${align === 'right' ? '0' : 'auto'} !important;
    max-width: 100% !important;
}
img[src^="${safeKey}"],
img[src*="${safeKey}"] {
    display: block !important;
    margin-left: ${align === 'left' ? '0' : 'auto'} !important;
    margin-right: ${align === 'right' ? '0' : 'auto'} !important;
    max-width: 100% !important;
}`);
            }
        }

        // Print rules
        lines.push('@media print { .ia-float-panel { display: none !important; } }');

        this.styleEl.textContent = lines.join('\n');
    }

    // ── Reading View & PDF Export Post-Processor ──────────────
    _postProcess(el) {
        el.querySelectorAll('img').forEach(img => {
            const key   = this._key(img);
            const align = this.data.alignments[key] || null;
            const host  = img.closest('.internal-embed') || img.closest('.image-embed') || img.closest('p') || img.parentElement;
            if (!host) return;

            host.classList.add('ia-host');
            DIRS.forEach(d => host.classList.remove('ia-' + d));
            if (align) host.classList.add('ia-' + align);
        });
    }

    // ── Floating Panel Management ─────────────────────────────
    _initFloatingPanel() {
        if (this.panel) return;

        this.panel = document.createElement('div');
        this.panel.className = 'ia-float-panel';
        document.body.appendChild(this.panel);

        this.panel.addEventListener('mouseenter', () => {
            if (this.hideTimer) clearTimeout(this.hideTimer);
        });

        this.panel.addEventListener('mouseleave', (e) => {
            if (e.relatedTarget === this.activeImg) return;
            this._hidePanel(120);
        });
    }

    _populatePanel(img) {
        if (!this.panel) return;
        this.panel.innerHTML = '';

        const key   = this._key(img);
        const saved = this.data.alignments[key] || null;

        DIRS.forEach(dir => {
            const btn = document.createElement('button');
            const isActive = saved === dir;
            btn.className   = 'ia-btn' + (isActive ? ' ia-on' : '');
            btn.dataset.dir = dir;
            btn.setAttribute('aria-label', `Align ${dir[0].toUpperCase() + dir.slice(1)}${isActive ? ' (Active - click to reset)' : ''}`);
            btn.innerHTML   = ICONS[dir];

            btn.addEventListener('mousedown', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const cur  = this.data.alignments[key] || null;
                const next = cur === dir ? null : dir; // Re-clicking active option toggles it off

                // Persist
                if (next) {
                    this.data.alignments[key] = next;
                } else {
                    delete this.data.alignments[key];
                }

                // Update UI buttons immediately
                this.panel.querySelectorAll('.ia-btn').forEach(b => {
                    const active = b.dataset.dir === next;
                    b.classList.toggle('ia-on', active);
                    const d = b.dataset.dir;
                    b.setAttribute('aria-label', `Align ${d[0].toUpperCase() + d.slice(1)}${active ? ' (Active - click to reset)' : ''}`);
                });

                await this._saveData();
                this._rebuildCSS();           // Instantly updates CSS for the active note
                this._refreshReadingViews();

                // Re-position toolbar to image's updated top-left position after layout shift
                requestAnimationFrame(() => {
                    if (this.activeImg) this._reposition(this.activeImg);
                });
            });

            this.panel.appendChild(btn);
        });
    }

    _reposition(img) {
        if (!img || !this.panel) return;

        const r = img.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
            this.panel.style.display = 'none';
            return;
        }

        // Hide if scrolled completely out of viewport
        if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
            this.panel.style.display = 'none';
            return;
        }

        const top = Math.max(8, r.top + 8);
        const left = Math.max(8, r.left + 8);

        this.panel.style.top = top + 'px';
        this.panel.style.left = left + 'px';
        this.panel.style.right = 'auto';
        this.panel.style.bottom = 'auto';
    }

    _showPanel(img) {
        if (!this.panel) this._initFloatingPanel();
        if (this.hideTimer) clearTimeout(this.hideTimer);

        if (this.activeImg === img && this.panel.style.display === 'flex') {
            return;
        }

        this.activeImg = img;
        this._populatePanel(img);
        this._reposition(img);
        this.panel.style.display = 'flex';
    }

    _hidePanel(delay = 180) {
        if (this.hideTimer) clearTimeout(this.hideTimer);
        this.hideTimer = setTimeout(() => {
            if (this.panel) this.panel.style.display = 'none';
            this.activeImg = null;
        }, delay);
    }

    // ── Event Handlers ────────────────────────────────────────
    _onMouseOver(e) {
        const target = e.target;
        if (!(target instanceof HTMLImageElement)) return;

        // Ensure image is inside an active Live Preview editor (source mode)
        const editorView = target.closest('.markdown-source-view.mod-cm6');
        if (!editorView) return;

        this._showPanel(target);
    }

    _onMouseOut(e) {
        if (e.target !== this.activeImg) return;
        if (e.relatedTarget && this.panel && this.panel.contains(e.relatedTarget)) return;
        this._hidePanel();
    }

    _onScroll() {
        if (this.activeImg && this.panel && this.panel.style.display !== 'none') {
            this._reposition(this.activeImg);
        }
    }

    _onResize() {
        if (this.activeImg && this.panel && this.panel.style.display !== 'none') {
            this._reposition(this.activeImg);
        }
    }

    // ── Refresh Reading View Panes ────────────────────────────
    _refreshReadingViews() {
        this.app.workspace.iterateAllLeaves(leaf => {
            if (!(leaf.view instanceof MarkdownView)) return;
            if (leaf.view.getMode() !== 'preview') return;
            try { leaf.view.previewMode.rerender(true); } catch (_) {}
        });
    }
}

module.exports = ImageAlignerPlugin;
