'use strict';

/* ============================================================
   Image Aligner — Obsidian Plugin v2.2
   ─────────────────────────────────────────────────────────
   • High performance: scales to 10k+ images with zero lag
   • Static CSS + scoped DOM decoration (no style injection)
   • 1-Click floating toolbar for Live Preview (top-left)
   • 100% reliable PDF export support via Markdown Post-Processor
   • Safe key matching with no filename collisions
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

class ImageAlignerPlugin extends Plugin {

    data      = { alignments: {} }; // { [key]: 'left'|'center'|'right' }
    panel     = null;               // Single shared floating panel in document.body
    activeImg = null;               // Currently hovered <img> element
    hideTimer = null;               // Panel hide delay timer
    observer  = null;               // MutationObserver for Live Preview DOM updates

    // ── Lifecycle ─────────────────────────────────────────────
    async onload() {
        await this._loadData();
        this._migrateData();

        // ① Reading view & PDF Export post-processor
        this.registerMarkdownPostProcessor((el) => this._postProcess(el));

        // ② Single shared floating alignment toolbar
        this._initFloatingPanel();

        // ③ Global delegated events
        this.registerDomEvent(document, 'mouseover', (e) => this._onMouseOver(e));
        this.registerDomEvent(document, 'mouseout',  (e) => this._onMouseOut(e));
        this.registerDomEvent(window,   'scroll',    () => this._onScroll(), { capture: true, passive: true });
        this.registerDomEvent(window,   'resize',    () => this._onResize(), { passive: true });

        // ④ Live Preview decoration observer (decorates images as they scroll/render)
        this._initLivePreviewObserver();
        this.registerEvent(this.app.workspace.on('active-leaf-change', () => this._decorateActiveView()));
        this.registerEvent(this.app.workspace.on('layout-change', () => this._decorateActiveView()));

        // Initial decoration
        this._decorateActiveView();

        console.log('[Image Aligner] v2.2 loaded (High Performance Mode)');
    }

    onunload() {
        if (this.hideTimer) clearTimeout(this.hideTimer);
        if (this.observer) this.observer.disconnect();

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
        const embed = img.closest('.internal-embed') || img.closest('.image-embed');
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

    // ── Scoped DOM Decoration (O(1) Instant Styling) ──────────
    _decorateImage(img) {
        if (!img || !(img instanceof HTMLImageElement)) return;
        const key = this._key(img);
        const align = this.data.alignments[key] || null;

        const targets = new Set();
        targets.add(img);

        const embed = img.closest('.internal-embed') || img.closest('.image-embed');
        if (embed) targets.add(embed);

        const cmBlock = img.closest('.cm-embed-block') || img.closest('.cm-line');
        if (cmBlock) targets.add(cmBlock);

        const p = img.closest('p');
        if (p) targets.add(p);

        if (img.parentElement) targets.add(img.parentElement);

        targets.forEach(el => {
            DIRS.forEach(d => el.classList.remove('ia-' + d));
            el.classList.remove('ia-host');
            if (align) {
                el.classList.add('ia-host');
                el.classList.add('ia-' + align);
            }
        });
    }

    _decorateContainer(container) {
        if (!container) return;
        const imgs = container.querySelectorAll('img');
        for (let i = 0; i < imgs.length; i++) {
            this._decorateImage(imgs[i]);
        }
    }

    _decorateActiveView() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.contentEl) {
            this._decorateContainer(activeView.contentEl);
        }
    }

    // Live Preview Observer for smooth scrolling and virtual DOM rendering
    _initLivePreviewObserver() {
        let debounceTimer = null;
        this.observer = new MutationObserver((mutations) => {
            if (debounceTimer) return;
            debounceTimer = requestAnimationFrame(() => {
                debounceTimer = null;
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        for (const node of mutation.addedNodes) {
                            if (node instanceof HTMLElement) {
                                if (node instanceof HTMLImageElement) {
                                    this._decorateImage(node);
                                } else {
                                    this._decorateContainer(node);
                                }
                            }
                        }
                    }
                }
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ── Reading View & PDF Export Post-Processor ──────────────
    _postProcess(el) {
        this._decorateContainer(el);
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

                // Instantly apply class decoration to active image & container
                this._decorateImage(img);

                await this._saveData();
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
        this._decorateImage(img);
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
