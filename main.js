'use strict';

/* ============================================================
   Image Aligner — Obsidian Plugin v2.1
   ─────────────────────────────────────────────────────────
   • Single lightweight floating toolbar for Live Preview
   • Non-destructive: alignments stored in plugin data & CSS
   • Full support for Live Preview, Reading View & PDF export
   • Theme-adaptive visuals using Obsidian CSS variables
   • Collision-safe image identifier matching
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

const DIRS   = ['left', 'center', 'right'];
const MARGIN = { left: '0 auto 0 0', center: '0 auto', right: '0 0 0 auto' };

// Safe CSS selector escape helper
function escapeCSS(str) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(str);
    }
    return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

// ─────────────────────────────────────────────────────────────
class ImageAlignerPlugin extends Plugin {

    data      = { alignments: {} }; // { [key]: 'left'|'center'|'right' }
    styleEl   = null;               // <style id="ia-dynamic"> in <head>
    panel     = null;               // Single shared floating panel in document.body
    activeImg = null;               // Currently hovered <img> element
    hideTimer = null;               // Panel hide delay timer

    // ── Lifecycle ─────────────────────────────────────────────
    async onload() {
        await this._loadData();
        this._migrateData();

        // ① Dynamic <style> for alignment across all modes and PDF export
        this.styleEl = document.createElement('style');
        this.styleEl.id = 'ia-dynamic';
        document.head.appendChild(this.styleEl);
        this._rebuildCSS();

        // ② Reading view post-processor (adds classes for print & reading view)
        this.registerMarkdownPostProcessor((el) => this._postProcess(el));

        // ③ Single shared floating alignment toolbar
        this._initFloatingPanel();

        // ④ Global delegated events (Obsidian handles cleanup on unload)
        this.registerDomEvent(document, 'mouseover', (e) => this._onMouseOver(e));
        this.registerDomEvent(document, 'mouseout',  (e) => this._onMouseOut(e));
        this.registerDomEvent(window,   'scroll',    () => this._onScroll(), { capture: true, passive: true });
        this.registerDomEvent(window,   'resize',    () => this._onResize(), { passive: true });

        console.log('[Image Aligner] v2.1 loaded');
    }

    onunload() {
        if (this.hideTimer) clearTimeout(this.hideTimer);
        this.styleEl?.remove();
        this.panel?.remove();
        this.panel = null;
        this.activeImg = null;

        // Safety cleanup of any stale floating panel elements
        document.querySelectorAll('.ia-float-panel').forEach(el => el.remove());
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

    // Aggressively migrate old keys to the new stable format
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
            } else if (!src.startsWith('link:') && !src.startsWith('file:') && !src.startsWith('http')) {
                newKey = 'link:' + src;
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
        const embed = img.closest('.internal-embed');
        if (embed) {
            let src = embed.getAttribute('src');
            if (src) {
                if (src.includes('|')) src = src.split('|')[0];
                return 'link:' + src.trim();
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

    // ── Dynamic CSS ───────────────────────────────────────────
    _rebuildCSS() {
        if (!this.styleEl) return;
        const lines = [];

        for (const [key, align] of Object.entries(this.data.alignments)) {
            if (!DIRS.includes(align)) continue;

            const marginValue = MARGIN[align];
            const textAlign   = align === 'center' ? 'center' : (align === 'right' ? 'right' : 'left');
            const justifyVal  = align === 'center' ? 'center' : (align === 'right' ? 'flex-end' : 'flex-start');

            const isLink = key.startsWith('link:');
            const rawPath = isLink ? key.substring(5).trim() : key.trim();

            if (isLink) {
                const filename = rawPath.split('/').pop().split('?')[0];
                const safeRaw = escapeCSS(rawPath);
                const safeFile = escapeCSS(filename);
                const encRaw = escapeCSS(encodeURIComponent(rawPath));
                const encFile = escapeCSS(encodeURIComponent(filename));

                // 1. Target Embed Containers (Live Preview & Reading View)
                // Uses exact matching or size-delimiter prefix to prevent substring collisions
                const containerSelectors = [
                    `.internal-embed[src="${safeRaw}"]`,
                    `.internal-embed[src^="${safeRaw}|"]`,
                    `.image-embed[src="${safeRaw}"]`,
                    `.image-embed[src^="${safeRaw}|"]`,
                    `.internal-embed[src$="/${safeRaw}"]`,
                    `.internal-embed[src*="/${safeRaw}|"]`
                ];

                lines.push(
                    `${containerSelectors.join(',\n')} {\n` +
                    `  display: flex !important;\n` +
                    `  justify-content: ${justifyVal} !important;\n` +
                    `  text-align: ${textAlign} !important;\n` +
                    `  margin: ${marginValue} !important;\n` +
                    `  width: 100% !important;\n` +
                    `}`
                );

                // 2. Target <img> elements directly
                const imgSelectors = [
                    `img[data-path="${safeRaw}"]`,
                    `img[src*="/${encRaw}?"]`,
                    `img[src$="/${encRaw}"]`,
                    `img[src*="/${encFile}?"]`,
                    `img[src$="/${encFile}"]`,
                    `img[src*="/${safeFile}?"]`,
                    `img[src$="/${safeFile}"]`,
                    `.markdown-source-view.mod-cm6 .cm-content .internal-embed[src="${safeRaw}"] img`,
                    `.markdown-source-view.mod-cm6 .cm-content .internal-embed[src^="${safeRaw}|"] img`
                ];

                lines.push(
                    `${imgSelectors.join(',\n')} {\n` +
                    `  display: block !important;\n` +
                    `  margin: ${marginValue} !important;\n` +
                    `  max-width: 100% !important;\n` +
                    `}`
                );
            } else {
                // External web image
                const safeKey = escapeCSS(rawPath);
                const extSelectors = [
                    `img[src="${safeKey}"]`,
                    `img[src^="${safeKey}?"]`,
                    `img[src^="${safeKey}#"]`
                ];

                lines.push(
                    `${extSelectors.join(',\n')} {\n` +
                    `  display: block !important;\n` +
                    `  margin: ${marginValue} !important;\n` +
                    `  max-width: 100% !important;\n` +
                    `}`
                );
            }
        }

        // Print rules: ensure floating toolbar is always hidden in PDF exports
        lines.push('@media print { .ia-float-panel { display: none !important; } }');

        this.styleEl.textContent = lines.join('\n\n');
    }

    // ── Reading View Post-Processor ───────────────────────────
    _postProcess(el) {
        el.querySelectorAll('img').forEach(img => {
            const key   = this._key(img);
            const align = this.data.alignments[key] || null;
            const host  = img.closest('.internal-embed') || img.closest('p') || img.parentElement;
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
                this._rebuildCSS();
                this._refreshReadingViews();

                // Re-position toolbar to image's updated position after layout shift
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
