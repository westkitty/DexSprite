/* ==========================================================================
   Dex Sprite Core Compiler Logic Engine — Premium Offline Slicer & Stabilizer
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Detect if running inside native macOS wrapper
    if (window.isNativeApp) {
        document.body.classList.add('native-app');
    }

    // --- Application State ---
    const state = {
        sourceImage: null,          // Original uploaded HTML Image element
        sourceWidth: 0,
        sourceHeight: 0,
        spriteW: 32,                // Current cell width
        spriteH: 32,                // Current cell height
        padding: 1,                 // Cell space bleed margin
        ditherType: 'none',         // 'none', 'floyd', 'bayer'
        fps: 10,
        
        // Grid slice collections
        slices: [],                 // List of all parsed cell slices: { id, x, y, active, dx, dy, dataUrl, pixels }
        activeSlices: [],           // Shortcut list of active slices
        
        // Loop timeline player
        isPlaying: true,
        currentFrameIdx: 0,
        playbackTimer: null,
        
        // Drag registration states
        isDragging: false,
        dragStart: { x: 0, y: 0 },
        draggedFrameIdx: null,
        
        // Compiled Retro Data
        masterPalette: [],          // Flat array of 256 colors * 3 RGB values
        masterColorsCount: 15,      // SNES/Console Budget
        compiledSheetCanvas: null,

        // Custom UI Zoom & Presets
        slicerZoom: 'fit',          // 'fit', '1', '2', '4', '8'
        playbackZoom: 4.0,          // 1x to 16x slider
        retroPreset: 'custom',       // 'custom', 'gb', 'gbc', 'nes', 'pico8'

        // Advanced Interactive States
        theme: 'cyber-neon',
        sfxEnabled: false,
        onionSkinEnabled: false,
        highlightedColor: null
    };

    // --- DOM Elements ---
    const els = {
        dropZone: document.getElementById('drop-zone'),
        fileInput: document.getElementById('file-input'),
        ditherSelect: document.getElementById('dither-select'),
        fpsSlider: document.getElementById('fps-slider'),
        fpsReadout: document.getElementById('fps-readout'),
        
        // Canvases
        slicerCanvas: document.getElementById('slicer-canvas'),
        atlasCanvas: document.getElementById('atlas-canvas'),
        playbackCanvas: document.getElementById('playback-canvas'),
        
        // Timeline & Info Readouts
        frameCounter: document.getElementById('frame-counter'),
        offsetReadout: document.getElementById('offset-readout'),
        statusText: document.getElementById('status-text'),
        
        // Controls
        btnPrev: document.getElementById('btn-prev'),
        btnPlay: document.getElementById('btn-play'),
        btnNext: document.getElementById('btn-next'),
        btnToggleActive: document.getElementById('btn-toggle-active'),
        btnReset: document.getElementById('btn-reset'),
        
        // Exporters
        btnExportPng: document.getElementById('btn-export-png'),
        btnExportGif: document.getElementById('btn-export-gif'),
        btnExportHtml: document.getElementById('btn-export-html'),
        
        // Tabs
        tabSlicer: document.getElementById('tab-slicer'),
        tabAtlas: document.getElementById('tab-atlas'),
        paneSlicer: document.getElementById('tab-content-slicer'),
        paneAtlas: document.getElementById('tab-content-atlas'),

        // UI Polish elements
        dragOverlay: document.getElementById('drag-overlay'),
        toastNotification: document.getElementById('toast-notification'),
        toastMessage: document.getElementById('toast-message'),
        presetSelect: document.getElementById('preset-select'),
        paletteSwatches: document.getElementById('palette-swatches'),
        playbackZoomSlider: document.getElementById('playback-zoom-slider'),
        playbackZoomReadout: document.getElementById('playback-zoom-readout'),
        filmstripContainer: document.getElementById('filmstrip-container'),

        // Advanced Interactive Elements
        themeSelect: document.getElementById('theme-select'),
        btnMagicSlice: document.getElementById('btn-magic-slice'),
        chkOnionSkin: document.getElementById('chk-onion-skin'),
        chkRetroSfx: document.getElementById('chk-retro-sfx')
    };

    // --- Tab Switching System ---
    els.tabSlicer.addEventListener('click', () => {
        playSynthSFX('click');
        switchTab('slicer');
    });
    els.tabAtlas.addEventListener('click', () => {
        playSynthSFX('click');
        switchTab('atlas');
    });

    function switchTab(target) {
        if (target === 'slicer') {
            els.tabSlicer.classList.add('active');
            els.tabAtlas.classList.remove('active');
            els.paneSlicer.classList.add('active');
            els.paneAtlas.classList.remove('active');
        } else {
            els.tabSlicer.classList.remove('active');
            els.tabAtlas.classList.add('active');
            els.paneSlicer.classList.remove('active');
            els.paneAtlas.classList.add('active');
            renderCompiledAtlas();
        }
    }

    // --- Drag and Drop Interface bindings ---
    // Fullscreen Glassmorphic Overlay for any file dragged onto the window
    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (els.dragOverlay) {
            els.dragOverlay.classList.add('active');
        }
    }, false);

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    }, false);

    if (els.dragOverlay) {
        els.dragOverlay.addEventListener('dragleave', (e) => {
            e.preventDefault();
            // Only hide if the cursor actually leaves the window/overlay boundaries
            if (e.target === els.dragOverlay) {
                els.dragOverlay.classList.remove('active');
            }
        }, false);

        els.dragOverlay.addEventListener('drop', (e) => {
            e.preventDefault();
            els.dragOverlay.classList.remove('active');
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length) handleFile(files[0]);
        }, false);
    }

    // Keep els.dropZone interactive for hover and browsing file click actions
    ['dragenter', 'dragover'].forEach(eventName => {
        els.dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            els.dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        els.dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            els.dropZone.classList.remove('dragover');
        }, false);
    });

    els.dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) handleFile(files[0]);
    });

    els.dropZone.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    // --- Config bindings ---
    document.querySelectorAll('input[name="sprite-size"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const [w, h] = e.target.value.split('x').map(Number);
            state.spriteW = w;
            state.spriteH = h;
            state.slices = []; // Reinitialize slices array on layout adjustment
            if (state.sourceImage) sliceAndRecompute();
        });
    });

    document.querySelectorAll('input[name="gutter-size"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.padding = Number(e.target.value);
            state.slices = []; // Reinitialize slices array on layout adjustment
            if (state.sourceImage) sliceAndRecompute();
        });
    });

    els.ditherSelect.addEventListener('change', (e) => {
        state.ditherType = e.target.value;
        if (state.sourceImage) sliceAndRecompute();
    });

    els.fpsSlider.addEventListener('input', (e) => {
        state.fps = Number(e.target.value);
        els.fpsReadout.textContent = `${state.fps} FPS`;
        if (state.isPlaying && state.sourceImage) {
            startPlaybackLoop();
        }
    });

    // Preset select binding
    if (els.presetSelect) {
        els.presetSelect.addEventListener('change', (e) => {
            state.retroPreset = e.target.value;
            playSynthSFX('swoosh');
            if (state.sourceImage) sliceAndRecompute();
        });
    }

    // Slicer Zoom bindings
    document.querySelectorAll('input[name="slicer-zoom"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.slicerZoom = e.target.value;
            applySlicerZoom();
        });
    });

    // Playback Zoom slider binding
    if (els.playbackZoomSlider) {
        els.playbackZoomSlider.addEventListener('input', (e) => {
            state.playbackZoom = Number(e.target.value);
            if (els.playbackZoomReadout) {
                els.playbackZoomReadout.textContent = `${state.playbackZoom.toFixed(1)}x`;
            }
            if (state.sourceImage) {
                renderPlaybackViewport();
            }
        });
    }

    // --- Playback controls bindings ---
    els.btnPlay.addEventListener('click', () => {
        playSynthSFX('click');
        togglePlayback();
    });
    els.btnPrev.addEventListener('click', () => {
        playSynthSFX('click');
        stepPrev();
    });
    els.btnNext.addEventListener('click', () => {
        playSynthSFX('click');
        stepNext();
    });
    els.btnToggleActive.addEventListener('click', () => {
        playSynthSFX('drop');
        toggleFrameActive();
    });
    els.btnReset.addEventListener('click', () => {
        playSynthSFX('pop');
        resetFrameOffset();
    });

    // --- Interactive Slicer Click Toggling ---
    els.slicerCanvas.addEventListener('click', (e) => {
        if (!state.sourceImage) return;
        const rect = els.slicerCanvas.getBoundingClientRect();
        
        // Map viewport click to actual source image coordinate space
        const scaleX = state.sourceWidth / rect.width;
        const scaleY = state.sourceHeight / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;
        
        // Find which cell was clicked
        const cellCol = Math.floor(clickX / state.spriteW);
        const cellRow = Math.floor(clickY / state.spriteH);
        
        const cols = Math.floor(state.sourceWidth / state.spriteW);
        const cellIdx = cellRow * cols + cellCol;
        
        if (cellIdx >= 0 && cellIdx < state.slices.length) {
            state.slices[cellIdx].active = !state.slices[cellIdx].active;
            playSynthSFX('click');
            sliceAndRecompute();
        }
    });

    // --- Drag Registration Alignment Viewport bindings ---
    els.playbackCanvas.addEventListener('mousedown', (e) => {
        if (!state.sourceImage || !state.activeSlices.length) return;
        state.isDragging = true;
        state.dragStart = { x: e.clientX, y: e.clientY };
        state.draggedFrameIdx = state.currentFrameIdx;
        
        // Auto-pause during alignment dragging to prevent timing race
        pausePlayback();
    });

    window.addEventListener('mousemove', (e) => {
        if (!state.isDragging) return;
        
        const dx = e.clientX - state.dragStart.x;
        const dy = e.clientY - state.dragStart.y;
        
        // Accumulate drag displacements into offset attributes
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            if (state.draggedFrameIdx === null || !state.activeSlices || state.draggedFrameIdx >= state.activeSlices.length) {
                state.isDragging = false;
                return;
            }
            const frame = state.activeSlices[state.draggedFrameIdx];
            if (!frame) {
                state.isDragging = false;
                return;
            }
            frame.dx += Math.round(dx / state.playbackZoom);
            frame.dy += Math.round(dy / state.playbackZoom);
            
            state.dragStart = { x: e.clientX, y: e.clientY };
            
            // Recompute and redraw viewports immediately
            updateFrameReadout();
            sliceAndRecompute(true); // Fast bypass path
        }
    });

    window.addEventListener('mouseup', () => {
        if (state.isDragging) {
            state.isDragging = false;
        }
    });

    // --- Loading Sprite Image File ---
    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            updateStatus('Error: Invalid file format. Please upload a raster image.', true);
            return;
        }
        
        updateStatus('Loading sheet assets...');
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                state.sourceImage = img;
                state.sourceWidth = img.width;
                state.sourceHeight = img.height;
                
                // Initialize clean offsets
                state.slices = [];
                state.currentFrameIdx = 0;
                
                sliceAndRecompute();
                enableControlButtons();
                updateStatus(`Uploaded "${file.name}" (${img.width}x${img.height}px). Slicing grid computed.`);
                
                // Play active loop by default
                playPlayback();
                playSynthSFX('success');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function enableControlButtons() {
        els.btnPrev.disabled = false;
        els.btnPlay.disabled = false;
        els.btnNext.disabled = false;
        els.btnToggleActive.disabled = false;
        els.btnReset.disabled = false;
        
        els.btnExportPng.disabled = false;
        els.btnExportGif.disabled = false;
        els.btnExportHtml.disabled = false;
    }

    // --- Core Processing Pipeline Engine ---
    function applySlicerZoom() {
        if (!state.sourceImage) return;
        if (state.slicerZoom === 'fit') {
            els.slicerCanvas.style.width = '100%';
            els.slicerCanvas.style.height = 'auto';
        } else {
            const zoomVal = Number(state.slicerZoom);
            els.slicerCanvas.style.width = `${state.sourceWidth * zoomVal}px`;
            els.slicerCanvas.style.height = `${state.sourceHeight * zoomVal}px`;
        }
    }

    // --- Core Processing Pipeline Engine ---
    function sliceAndRecompute(isMinorDrag = false) {
        if (!state.sourceImage) return;
        
        const w = state.spriteW;
        const h = state.spriteH;
        const cols = Math.floor(state.sourceWidth / w);
        const rows = Math.floor(state.sourceHeight / h);
        
        // 1. Compute visual slices on first load or sizes adjustments
        if (state.slices.length === 0) {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    state.slices.push({
                        id: r * cols + c,
                        col: c,
                        row: r,
                        x: c * w,
                        y: r * h,
                        active: true,
                        dx: 0,
                        dy: 0
                    });
                }
            }
        }
        
        // 2. Filter Active sprite frames strictly
        state.activeSlices = state.slices.filter(s => s.active);
        
        if (state.activeSlices.length === 0) {
            updateStatus('Warning: All grid frames disabled. No sprites active.', true);
            clearCanvases();
            return;
        }
        
        // Adjust loop boundary bounds
        if (state.currentFrameIdx >= state.activeSlices.length) {
            state.currentFrameIdx = 0;
        }
        
        // 3. Render Slicer Editor Viewport Grid
        renderSlicerGrid();
        applySlicerZoom();
        
        // 4. Global Quantization Palette Calculations (Median Cut)
        // Skip heavy recalculation during minor drag alignments for 60fps performance
        if (!isMinorDrag) {
            computeGlobalMasterPalette();
        }
        
        // 5. Draw playback viewports
        renderPlaybackViewport();
        
        // 6. Draw Atlas Viewport if tab active
        if (els.tabAtlas.classList.contains('active')) {
            renderCompiledAtlas();
        }

        // 7. Render/refresh animation filmstrip timeline sequence thumbnails
        renderFilmstripTimeline();
    }

    function clearCanvases() {
        els.slicerCanvas.getContext('2d').clearRect(0, 0, els.slicerCanvas.width, els.slicerCanvas.height);
        els.atlasCanvas.getContext('2d').clearRect(0, 0, els.atlasCanvas.width, els.atlasCanvas.height);
        els.playbackCanvas.getContext('2d').clearRect(0, 0, els.playbackCanvas.width, els.playbackCanvas.height);
        els.frameCounter.textContent = "0/0";
        els.offsetReadout.textContent = "X: +0px, Y: +0px";
        if (els.paletteSwatches) {
            els.paletteSwatches.innerHTML = '<div class="swatch-empty-msg">No palette extracted yet</div>';
        }
        if (els.filmstripContainer) {
            els.filmstripContainer.innerHTML = '<div class="filmstrip-empty-msg">No active animation loop loaded</div>';
        }
    }

    // --- Render Grid Slicer ---
    function renderSlicerGrid() {
        const ctx = els.slicerCanvas.getContext('2d');
        const img = state.sourceImage;
        
        els.slicerCanvas.width = state.sourceWidth;
        els.slicerCanvas.height = state.sourceHeight;
        
        ctx.clearRect(0, 0, state.sourceWidth, state.sourceHeight);
        ctx.drawImage(img, 0, 0);
        
        // Draw slice cells boundaries
        const w = state.spriteW;
        const h = state.spriteH;
        
        state.slices.forEach((slice) => {
            if (slice.active) {
                // Active bounding box (subtle translucent borders)
                ctx.strokeStyle = 'rgba(10, 132, 255, 0.4)';
                ctx.lineWidth = 1;
                ctx.strokeRect(slice.x, slice.y, w, h);
            } else {
                // Inactive bounding box (dimmed grey frosted fill)
                ctx.fillStyle = 'rgba(20, 20, 24, 0.85)';
                ctx.fillRect(slice.x, slice.y, w, h);
                
                ctx.strokeStyle = 'rgba(255, 69, 58, 0.35)';
                ctx.lineWidth = 1;
                ctx.strokeRect(slice.x, slice.y, w, h);
                
                // Draw red crossing lines indicating exclusion
                ctx.beginPath();
                ctx.moveTo(slice.x, slice.y);
                ctx.lineTo(slice.x + w, slice.y + h);
                ctx.moveTo(slice.x + w, slice.y);
                ctx.lineTo(slice.x, slice.y + h);
                ctx.stroke();
            }
        });
    }

    // --- Pure JS Median Cut 15-Bit Quantizer ---
    // Preset Palettes Constants
    const NES_PALETTE = [
        [124,124,124], [  0,  0,252], [  0,  0,188], [ 68, 40,188],
        [148,  0,132], [168,  0, 32], [168, 16,  0], [136, 20,  0],
        [ 80, 48,  0], [  0,120,  0], [  0,104,  0], [  0, 88,  0],
        [  0, 64, 88], [  0,  0,  0], [  0,  0,  0], [  0,  0,  0],
        [188,188,188], [  0,120,248], [  0, 88,248], [104, 68,252],
        [216,  0,204], [228,  0, 88], [248, 56,  0], [228, 92, 16],
        [172,124,  0], [  0,184,  0], [  0,168,  0], [  0,168, 68],
        [  0,136,136], [  0,  0,  0], [  0,  0,  0], [  0,  0,  0],
        [248,248,248], [ 60,188,252], [104,136,252], [152,120,248],
        [248,120,248], [248, 120,152], [248,120, 88], [240,208, 60],
        [236,228,  0], [ 76,240,  0], [124,244, 68], [  0,248,120],
        [  0,232,188], [  0,  0,  0], [  0,  0,  0], [  0,  0,  0],
        [252,252,252], [164,228,252], [184,204,252], [204,188,252],
        [248,188,252], [248,164,196], [248,192,164], [248,228,160],
        [248,248,120], [172,248,120], [156,252,168], [164,252,204],
        [164,244,244], [  0,  0,  0], [  0,  0,  0], [  0,  0,  0]
    ];

    const PICO8_PALETTE = [
        [0, 0, 0], [29, 43, 83], [126, 37, 83], [0, 135, 81],
        [171, 82, 54], [95, 87, 79], [194, 195, 199], [255, 241, 232],
        [255, 0, 77], [255, 163, 0], [255, 236, 39], [0, 228, 54],
        [41, 173, 255], [131, 118, 156], [255, 119, 168], [255, 204, 170]
    ];

    const GB_PALETTE = [
        [15, 56, 15],
        [48, 98, 48],
        [139, 172, 15],
        [155, 188, 15]
    ];

    function getClosestColorInList(r, g, b, list) {
        let minDist = Infinity;
        let closest = list[0];
        for (let i = 0; i < list.length; i++) {
            const c = list[i];
            const dist = Math.pow(r - c[0], 2) + Math.pow(g - c[1], 2) + Math.pow(b - c[2], 2);
            if (dist < minDist) {
                minDist = dist;
                closest = c;
            }
        }
        return closest;
    }

    function renderPaletteSwatches() {
        if (!els.paletteSwatches) return;
        els.paletteSwatches.innerHTML = '';
        
        // We render exactly 16 slots (indices 0 to 14 from extracted colors, index 15 transparent Magenta)
        for (let i = 0; i < 16; i++) {
            const swatch = document.createElement('div');
            const color = state.masterPalette[i];
            
            if (!color) continue;
            
            const r = color[0];
            const g = color[1];
            const b = color[2];
            const hex = rgbToHex(r, g, b);
            
            swatch.className = 'palette-swatch';
            swatch.setAttribute('data-hex', hex);
            
            if (i === 15) {
                swatch.classList.add('transparent-slot');
                swatch.setAttribute('data-hex', 'Transparent (#FF00FF)');
            } else {
                swatch.style.backgroundColor = hex;
            }
            
            swatch.addEventListener('click', () => {
                const hexVal = i === 15 ? '#FF00FF' : hex;
                navigator.clipboard.writeText(hexVal).then(() => {
                    showToast(`Copied color ${hexVal} to clipboard!`);
                });
            });

            // Swatch hover highlights active x-ray alignment isolates
            swatch.addEventListener('mouseenter', () => {
                if (i === 15) return; // Ignore transparency index
                state.highlightedColor = color;
                playSynthSFX('swoosh');
                if (state.sourceImage) {
                    renderPlaybackViewport();
                }
            });

            swatch.addEventListener('mouseleave', () => {
                state.highlightedColor = null;
                if (state.sourceImage) {
                    renderPlaybackViewport();
                }
            });
            
            els.paletteSwatches.appendChild(swatch);
        }
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16).toUpperCase();
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    let toastTimer = null;
    function showToast(message) {
        if (!els.toastNotification) return;
        if (toastTimer) clearTimeout(toastTimer);
        
        els.toastMessage.textContent = message;
        els.toastNotification.classList.add('show');
        
        toastTimer = setTimeout(() => {
            els.toastNotification.classList.remove('show');
        }, 2500);
    }

    // --- Pure JS Median Cut Presets & Quantizer ---
    function computeGlobalMasterPalette() {
        // Collect opaque RGB pixels from all active sliced frames
        const pixels = [];
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = state.spriteW;
        tempCanvas.height = state.spriteH;
        
        state.activeSlices.forEach(slice => {
            tempCtx.clearRect(0, 0, state.spriteW, state.spriteH);
            
            // Draw cropped crop box with custom registration X/Y offsets
            tempCtx.drawImage(
                state.sourceImage,
                slice.x + slice.dx, slice.y + slice.dy, state.spriteW, state.spriteH,
                0, 0, state.spriteW, state.spriteH
            );
            
            const imgData = tempCtx.getImageData(0, 0, state.spriteW, state.spriteH);
            const data = imgData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];
                
                if (a >= 128) { // Filter transparent pixels strictly
                    pixels.push([r, g, b]);
                }
            }
        });
        
        if (pixels.length === 0) {
            pixels.push([0, 0, 0]);
        }

        // Initialize clean master palette array
        state.masterPalette = [];
        
        if (state.retroPreset === 'gb') {
            // GameBoy Classic locks strictly to 4 hardware shades of green
            GB_PALETTE.forEach(color => {
                state.masterPalette.push([...color]);
            });
            while (state.masterPalette.length < 15) {
                state.masterPalette.push([0, 0, 0]);
            }
        } 
        else if (state.retroPreset === 'nes') {
            // Map pixels to closest NES colors
            const nesMappedPixels = pixels.map(p => getClosestColorInList(p[0], p[1], p[2], NES_PALETTE));
            
            // Frequency count the top NES hardware colors used
            const counts = {};
            nesMappedPixels.forEach(p => {
                const key = `${p[0]},${p[1]},${p[2]}`;
                counts[key] = (counts[key] || 0) + 1;
            });
            
            const sortedNESColors = Object.keys(counts)
                .map(key => ({ color: key.split(',').map(Number), count: counts[key] }))
                .sort((a, b) => b.count - a.count);
            
            // Extract top 15 NES colors
            for (let i = 0; i < 15; i++) {
                if (sortedNESColors[i]) {
                    state.masterPalette.push(sortedNESColors[i].color);
                } else {
                    state.masterPalette.push([0, 0, 0]);
                }
            }
        } 
        else if (state.retroPreset === 'pico8') {
            // Map pixels to closest PICO-8 colors
            const picoMappedPixels = pixels.map(p => getClosestColorInList(p[0], p[1], p[2], PICO8_PALETTE));
            
            // Frequency count
            const counts = {};
            picoMappedPixels.forEach(p => {
                const key = `${p[0]},${p[1]},${p[2]}`;
                counts[key] = (counts[key] || 0) + 1;
            });
            
            const sortedPicoColors = Object.keys(counts)
                .map(key => ({ color: key.split(',').map(Number), count: counts[key] }))
                .sort((a, b) => b.count - a.count);
                
            // Extract top 15 PICO-8 colors
            for (let i = 0; i < 15; i++) {
                if (sortedPicoColors[i]) {
                    state.masterPalette.push(sortedPicoColors[i].color);
                } else {
                    state.masterPalette.push([0, 0, 0]);
                }
            }
        } 
        else {
            // 'custom' / 'gbc': Median Cut Color Bucket Builder
            const palette = medianCut(pixels, state.masterColorsCount);
            
            // Convert extracted RGB centers to locked 15-bit color boundaries
            palette.forEach(color => {
                const r = Math.round(color[0] / 8) * 8;
                const g = Math.round(color[1] / 8) * 8;
                const b = Math.round(color[2] / 8) * 8;
                state.masterPalette.push([r, g, b]);
            });
            
            while (state.masterPalette.length < 15) {
                state.masterPalette.push([0, 0, 0]);
            }
        }
        
        // Inject locked transparent chroma-key Magenta #FF00FF as Color Index 15
        state.masterPalette[15] = [255, 0, 255];
        
        // Pad out color table up to 256 colors for locked PNG index compatibility
        while (state.masterPalette.length < 256) {
            state.masterPalette.push([0, 0, 0]);
        }

        // Render dynamic swatch panels
        renderPaletteSwatches();
    }

    // Median Cut implementation
    function medianCut(pixels, maxColors) {
        let buckets = [pixels];
        
        while (buckets.length < maxColors) {
            // Find bucket with largest volume
            let splitIdx = -1;
            let maxVol = -1;
            for (let i = 0; i < buckets.length; i++) {
                if (buckets[i].length > 1 && buckets[i].length > maxVol) {
                    maxVol = buckets[i].length;
                    splitIdx = i;
                }
            }
            
            if (splitIdx === -1) break; // Can't divide further
            
            // Split bucket along axis of widest color channel range
            const bucket = buckets[splitIdx];
            let minR = 255, maxR = 0;
            let minG = 255, maxG = 0;
            let minB = 255, maxB = 0;
            
            bucket.forEach(p => {
                if (p[0] < minR) minR = p[0]; if (p[0] > maxR) maxR = p[0];
                if (p[1] < minG) minG = p[1]; if (p[1] > maxG) maxG = p[1];
                if (p[2] < minB) minB = p[2]; if (p[2] > maxB) maxB = p[2];
            });
            
            const rRange = maxR - minR;
            const gRange = maxG - minG;
            const bRange = maxB - minB;
            
            let sortAxis = 0; // Red
            if (gRange >= rRange && gRange >= bRange) sortAxis = 1;
            else if (bRange >= rRange && bRange >= gRange) sortAxis = 2;
            
            bucket.sort((a, b) => a[sortAxis] - b[sortAxis]);
            
            const median = Math.floor(bucket.length / 2);
            const left = bucket.slice(0, median);
            const right = bucket.slice(median);
            
            buckets.splice(splitIdx, 1, left, right);
        }
        
        // Calculate average color centers of buckets
        return buckets.map(bucket => {
            let sumR = 0, sumG = 0, sumB = 0;
            bucket.forEach(p => {
                sumR += p[0];
                sumG += p[1];
                sumB += p[2];
            });
            return [
                Math.round(sumR / bucket.length),
                Math.round(sumG / bucket.length),
                Math.round(sumB / bucket.length)
            ];
        });
    }

    // --- Apply Quantization & Custom Dither Matrix on frame images ---
    function quantizeSliceFrame(slice, targetCtx, isPlayback = false) {
        // Draw target slice on scratchpad
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = state.spriteW;
        srcCanvas.height = state.spriteH;
        const srcCtx = srcCanvas.getContext('2d');
        
        srcCtx.drawImage(
            state.sourceImage,
            slice.x + slice.dx, slice.y + slice.dy, state.spriteW, state.spriteH,
            0, 0, state.spriteW, state.spriteH
        );
        
        const imgData = srcCtx.getImageData(0, 0, state.spriteW, state.spriteH);
        const data = imgData.data;
        const width = state.spriteW;
        const height = state.spriteH;
        
        // Create matching empty output ImageData
        const outputImgData = targetCtx.createImageData(width, height);
        const outData = outputImgData.data;
        
        if (state.ditherType === 'floyd') {
            // --- Floyd-Steinberg Error Diffusion Quantization ---
            // Create double precision working buffer
            const workBuffer = new Float32Array(width * height * 3);
            for (let i = 0; i < data.length; i += 4) {
                const idx = (i / 4) * 3;
                workBuffer[idx] = data[i];     // R
                workBuffer[idx + 1] = data[i+1]; // G
                workBuffer[idx + 2] = data[i+2]; // B
            }
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixelIdx = (y * width + x);
                    const bufIdx = pixelIdx * 3;
                    const aIdx = pixelIdx * 4 + 3;
                    const alpha = data[aIdx];
                    
                    if (alpha < 128) {
                        // Map transparent color directly to Magenta Index 15
                        outData[pixelIdx * 4] = 255;
                        outData[pixelIdx * 4 + 1] = 0;
                        outData[pixelIdx * 4 + 2] = 255;
                        outData[pixelIdx * 4 + 3] = 0; // Completely transparent
                        continue;
                    }
                    
                    const oldR = workBuffer[bufIdx];
                    const oldG = workBuffer[bufIdx + 1];
                    const oldB = workBuffer[bufIdx + 2];
                    
                    // Match nearest global palette index (colors 0 to 14 strictly, excluding 15)
                    const closestColor = findClosestPaletteColor(oldR, oldG, oldB);
                    
                    if (isPlayback && state.highlightedColor) {
                        const isMatch = closestColor[0] === state.highlightedColor[0] &&
                                        closestColor[1] === state.highlightedColor[1] &&
                                        closestColor[2] === state.highlightedColor[2];
                        if (isMatch) {
                            outData[pixelIdx * 4] = closestColor[0];
                            outData[pixelIdx * 4 + 1] = closestColor[1];
                            outData[pixelIdx * 4 + 2] = closestColor[2];
                            outData[pixelIdx * 4 + 3] = 255;
                        } else {
                            outData[pixelIdx * 4] = Math.round(closestColor[0] * 0.15);
                            outData[pixelIdx * 4 + 1] = Math.round(closestColor[1] * 0.15);
                            outData[pixelIdx * 4 + 2] = Math.round(closestColor[2] * 0.15);
                            outData[pixelIdx * 4 + 3] = 40; // translucent alpha
                        }
                    } else {
                        outData[pixelIdx * 4] = closestColor[0];
                        outData[pixelIdx * 4 + 1] = closestColor[1];
                        outData[pixelIdx * 4 + 2] = closestColor[2];
                        outData[pixelIdx * 4 + 3] = 255; // Completely Opaque
                    }
                    
                    // Diffusion color error factor
                    const errR = oldR - closestColor[0];
                    const errG = oldG - closestColor[1];
                    const errB = oldB - closestColor[2];
                    
                    // Diffuse coefficients (7/16 right, 3/16 bottom-left, 5/16 bottom, 1/16 bottom-right)
                    distributeError(workBuffer, x + 1, y, width, height, errR * 7/16, errG * 7/16, errB * 7/16);
                    distributeError(workBuffer, x - 1, y + 1, width, height, errR * 3/16, errG * 3/16, errB * 3/16);
                    distributeError(workBuffer, x, y + 1, width, height, errR * 5/16, errG * 5/16, errB * 5/16);
                    distributeError(workBuffer, x + 1, y + 1, width, height, errR * 1/16, errG * 1/16, errB * 1/16);
                }
            }
        } 
        else if (state.ditherType === 'bayer') {
            // --- Bayer 4x4 Ordered Matrix Dithering ---
            const bayerMatrix = [
                [  0, 128,  32, 160],
                [192,  64, 224,  96],
                [ 48, 176,  16, 144],
                [240, 112, 208,  80]
            ];
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixelIdx = (y * width + x);
                    const i = pixelIdx * 4;
                    const alpha = data[i + 3];
                    
                    if (alpha < 128) {
                        outData[i] = 255;
                        outData[i + 1] = 0;
                        outData[i + 2] = 255;
                        outData[i + 3] = 0;
                        continue;
                    }
                    
                    // Bayer halftone mesh intensity constant (shifting ranges by +/- 24)
                    const factor = (bayerMatrix[y % 4][x % 4] / 255) - 0.5;
                    const offset = factor * 48;
                    
                    const oldR = Math.max(0, Math.min(255, data[i] + offset));
                    const oldG = Math.max(0, Math.min(255, data[i + 1] + offset));
                    const oldB = Math.max(0, Math.min(255, data[i + 2] + offset));
                    
                    const closestColor = findClosestPaletteColor(oldR, oldG, oldB);
                    
                    if (isPlayback && state.highlightedColor) {
                        const isMatch = closestColor[0] === state.highlightedColor[0] &&
                                        closestColor[1] === state.highlightedColor[1] &&
                                        closestColor[2] === state.highlightedColor[2];
                        if (isMatch) {
                            outData[i] = closestColor[0];
                            outData[i + 1] = closestColor[1];
                            outData[i + 2] = closestColor[2];
                            outData[i + 3] = 255;
                        } else {
                            outData[i] = Math.round(closestColor[0] * 0.15);
                            outData[i + 1] = Math.round(closestColor[1] * 0.15);
                            outData[i + 2] = Math.round(closestColor[2] * 0.15);
                            outData[i + 3] = 40;
                        }
                    } else {
                        outData[i] = closestColor[0];
                        outData[i + 1] = closestColor[1];
                        outData[i + 2] = closestColor[2];
                        outData[i + 3] = 255;
                    }
                }
            }
        } 
        else {
            // --- Direct palette mapping quantization (No Dither) ---
            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3];
                if (alpha < 128) {
                    outData[i] = 255;
                    outData[i + 1] = 0;
                    outData[i + 2] = 255;
                    outData[i + 3] = 0;
                } else {
                    const closestColor = findClosestPaletteColor(data[i], data[i+1], data[i+2]);
                    if (isPlayback && state.highlightedColor) {
                        const isMatch = closestColor[0] === state.highlightedColor[0] &&
                                        closestColor[1] === state.highlightedColor[1] &&
                                        closestColor[2] === state.highlightedColor[2];
                        if (isMatch) {
                            outData[i] = closestColor[0];
                            outData[i + 1] = closestColor[1];
                            outData[i + 2] = closestColor[2];
                            outData[i + 3] = 255;
                        } else {
                            outData[i] = Math.round(closestColor[0] * 0.15);
                            outData[i + 1] = Math.round(closestColor[1] * 0.15);
                            outData[i + 2] = Math.round(closestColor[2] * 0.15);
                            outData[i + 3] = 40;
                        }
                    } else {
                        outData[i] = closestColor[0];
                        outData[i + 1] = closestColor[1];
                        outData[i + 2] = closestColor[2];
                        outData[i + 3] = 255;
                    }
                }
            }
        }
        
        targetCtx.putImageData(outputImgData, 0, 0);
    }

    function distributeError(buffer, x, y, width, height, errR, errG, errB) {
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        const idx = (y * width + x) * 3;
        buffer[idx] += errR;
        buffer[idx + 1] += errG;
        buffer[idx + 2] += errB;
    }

    function findClosestPaletteColor(r, g, b) {
        let minDist = Infinity;
        let closestColor = state.masterPalette[0];
        
        // Scan index 0 to 14 strictly, preserving Index 15 exclusively for transparency chroma
        for (let i = 0; i < 15; i++) {
            const palColor = state.masterPalette[i];
            const dist = Math.pow(r - palColor[0], 2) + 
                         Math.pow(g - palColor[1], 2) + 
                         Math.pow(b - palColor[2], 2);
                         
            if (dist < minDist) {
                minDist = dist;
                closestColor = palColor;
            }
        }
        return closestColor;
    }

    // --- Render Playback loop Viewport ---
    function renderPlaybackViewport() {
        if (!state.activeSlices.length) return;
        
        const canvas = els.playbackCanvas;
        const ctx = canvas.getContext('2d');
        
        const containerW = canvas.parentElement.clientWidth;
        const containerH = canvas.parentElement.clientHeight;
        
        canvas.width = containerW;
        canvas.height = containerH;
        
        ctx.clearRect(0, 0, containerW, containerH);
        
        // Grab current frame slice
        const slice = state.activeSlices[state.currentFrameIdx];
        
        // Create intermediate double buffer for crisp scaling
        const bufferCanvas = document.createElement('canvas');
        bufferCanvas.width = state.spriteW;
        bufferCanvas.height = state.spriteH;
        const bufferCtx = bufferCanvas.getContext('2d');
        
        // Quantize frame onto buffer with isPlayback = true
        quantizeSliceFrame(slice, bufferCtx, true);
        
        // Scale and composite buffer canvas on viewport center sharply using selected zoom scale
        const scale = state.playbackZoom;
        const w = state.spriteW * scale;
        const h = state.spriteH * scale;
        
        const x = (containerW - w) / 2;
        const y = (containerH - h) / 2;
        
        ctx.imageSmoothingEnabled = false; // direct nearest-neighbor magnification
        
        // Draw Onion Skin overlays behind the active frame if enabled
        if (state.onionSkinEnabled && state.activeSlices.length > 1) {
            // Preceding active frame (25% opacity)
            const prevIdx = (state.currentFrameIdx - 1 + state.activeSlices.length) % state.activeSlices.length;
            const prevSlice = state.activeSlices[prevIdx];
            const prevCanvas = document.createElement('canvas');
            prevCanvas.width = state.spriteW;
            prevCanvas.height = state.spriteH;
            const prevCtx = prevCanvas.getContext('2d');
            quantizeSliceFrame(prevSlice, prevCtx, true);
            
            ctx.globalAlpha = 0.25;
            ctx.drawImage(prevCanvas, x, y, w, h);
            
            // Succeeding active frame (12% opacity)
            const nextIdx = (state.currentFrameIdx + 1) % state.activeSlices.length;
            const nextSlice = state.activeSlices[nextIdx];
            const nextCanvas = document.createElement('canvas');
            nextCanvas.width = state.spriteW;
            nextCanvas.height = state.spriteH;
            const nextCtx = nextCanvas.getContext('2d');
            quantizeSliceFrame(nextSlice, nextCtx, true);
            
            ctx.globalAlpha = 0.12;
            ctx.drawImage(nextCanvas, x, y, w, h);
            
            // Restore normal opacity
            ctx.globalAlpha = 1.0;
        }
        
        // Draw primary active frame sharply
        ctx.drawImage(bufferCanvas, x, y, w, h);
        
        // Update Frame HUD Readouts
        updateFrameReadout();
    }

    function updateFrameReadout() {
        if (!state.activeSlices.length) return;
        const slice = state.activeSlices[state.currentFrameIdx];
        els.frameCounter.textContent = `${state.currentFrameIdx + 1} / ${state.activeSlices.length}`;
        
        const signX = slice.dx >= 0 ? '+' : '';
        const signY = slice.dy >= 0 ? '+' : '';
        els.offsetReadout.textContent = `X: ${signX}${slice.dx}px, Y: ${signY}${slice.dy}px`;
    }

    // --- Compile Texture Sprite Sheet Atlas Map ---
    function renderCompiledAtlas() {
        if (!state.activeSlices.length) return;
        
        const numFrames = state.activeSlices.length;
        const cols = Math.ceil(Math.sqrt(numFrames));
        const rows = Math.ceil(numFrames / cols);
        
        const cellW = state.spriteW;
        const cellH = state.spriteH;
        const padding = state.padding;
        
        const sheetW = (cellW * cols) + (padding * (cols + 1));
        const sheetH = (cellH * rows) + (padding * (rows + 1));
        
        // Set master compiled canvas size
        state.compiledSheetCanvas = document.createElement('canvas');
        state.compiledSheetCanvas.width = sheetW;
        state.compiledSheetCanvas.height = sheetH;
        const sheetCtx = state.compiledSheetCanvas.getContext('2d');
        
        // Flood fill transparent locked magenta gutter backing
        sheetCtx.fillStyle = '#FF00FF';
        sheetCtx.fillRect(0, 0, sheetW, sheetH);
        
        // Paste dithered active frames in sequence
        state.activeSlices.forEach((slice, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            
            const px = (col * cellW) + (padding * (col + 1));
            const py = (row * cellH) + (padding * (row + 1));
            
            const cellCanvas = document.createElement('canvas');
            cellCanvas.width = cellW;
            cellCanvas.height = cellH;
            const cellCtx = cellCanvas.getContext('2d');
            
            quantizeSliceFrame(slice, cellCtx);
            
            // Draw on compiled canvas map
            sheetCtx.drawImage(cellCanvas, px, py);
        });
        
        // Display inside atlas preview viewport
        const canvas = els.atlasCanvas;
        const ctx = canvas.getContext('2d');
        
        const containerW = canvas.parentElement.clientWidth;
        const containerH = canvas.parentElement.clientHeight;
        
        canvas.width = containerW;
        canvas.height = containerH;
        
        ctx.clearRect(0, 0, containerW, containerH);
        
        const scale = Math.max(1, Math.min(containerW / sheetW, containerH / sheetH) * 0.9);
        const w = sheetW * scale;
        const h = sheetH * scale;
        
        const x = (containerW - w) / 2;
        const y = (containerH - h) / 2;
        
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(state.compiledSheetCanvas, x, y, w, h);
    }

    // --- Filmstrip Animation Timeline Track ---
    function renderFilmstripTimeline() {
        if (!els.filmstripContainer) return;
        
        if (!state.activeSlices.length) {
            els.filmstripContainer.innerHTML = '<div class="filmstrip-empty-msg">No active animation loop loaded</div>';
            return;
        }
        
        els.filmstripContainer.innerHTML = '';
        
        state.activeSlices.forEach((slice, index) => {
            const card = document.createElement('div');
            card.className = 'filmstrip-card';
            if (index === state.currentFrameIdx) {
                card.classList.add('active');
            }
            
            // Create tiny thumbnail canvas
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = state.spriteW;
            thumbCanvas.height = state.spriteH;
            thumbCanvas.className = 'filmstrip-card-img';
            const thumbCtx = thumbCanvas.getContext('2d');
            
            // Quantize frame onto thumbnail
            quantizeSliceFrame(slice, thumbCtx);
            
            card.appendChild(thumbCanvas);
            
            // Add index label
            const indexLabel = document.createElement('span');
            indexLabel.className = 'filmstrip-card-index';
            indexLabel.textContent = index + 1;
            card.appendChild(indexLabel);
            
            // Click to jump to frame
            card.addEventListener('click', () => {
                pausePlayback();
                state.currentFrameIdx = index;
                renderPlaybackViewport();
                updateFilmstripActiveFrame();
            });
            
            els.filmstripContainer.appendChild(card);
            
            // Auto-scroll active card into focus during initial build
            if (index === state.currentFrameIdx) {
                card.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
            }
        });
    }

    function updateFilmstripActiveFrame() {
        if (!els.filmstripContainer) return;
        const cards = els.filmstripContainer.querySelectorAll('.filmstrip-card');
        cards.forEach((card, index) => {
            if (index === state.currentFrameIdx) {
                card.classList.add('active');
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                card.classList.remove('active');
            }
        });
    }

    // --- Looping Diagnostic Playback Controls ---
    function startPlaybackLoop() {
        if (state.playbackTimer) clearInterval(state.playbackTimer);
        state.playbackTimer = setInterval(() => {
            if (!state.activeSlices.length || !state.isPlaying) return;
            state.currentFrameIdx = (state.currentFrameIdx + 1) % state.activeSlices.length;
            renderPlaybackViewport();
            updateFilmstripActiveFrame();
        }, 1000 / state.fps);
    }

    function togglePlayback() {
        if (state.isPlaying) {
            pausePlayback();
        } else {
            playPlayback();
        }
    }

    function pausePlayback() {
        state.isPlaying = false;
        els.btnPlay.textContent = '▶ Play';
        els.btnPlay.classList.remove('accent-btn');
    }

    function playPlayback() {
        state.isPlaying = true;
        els.btnPlay.textContent = '⏸ Pause';
        els.btnPlay.classList.add('accent-btn');
        startPlaybackLoop();
    }

    function stepNext() {
        if (!state.activeSlices.length) return;
        pausePlayback();
        state.currentFrameIdx = (state.currentFrameIdx + 1) % state.activeSlices.length;
        renderPlaybackViewport();
        updateFilmstripActiveFrame();
    }

    function stepPrev() {
        if (!state.activeSlices.length) return;
        pausePlayback();
        state.currentFrameIdx = (state.currentFrameIdx - 1 + state.activeSlices.length) % state.activeSlices.length;
        renderPlaybackViewport();
        updateFilmstripActiveFrame();
    }

    function toggleFrameActive() {
        if (!state.activeSlices.length) return;
        const slice = state.activeSlices[state.currentFrameIdx];
        slice.active = false; // Disable slice
        
        sliceAndRecompute();
    }

    function resetFrameOffset() {
        if (!state.activeSlices.length) return;
        const slice = state.activeSlices[state.currentFrameIdx];
        slice.dx = 0;
        slice.dy = 0;
        
        sliceAndRecompute(true);
    }

    // --- Helper Status logger ---
    function updateStatus(text, isError = false) {
        els.statusText.textContent = text;
        els.statusText.style.color = isError ? 'var(--danger-red)' : 'var(--text-mid)';
    }

    // --- Dynamic Exporter Hybrid Bridge (WebKit Message Bridge / Graceful Browser Fallback) ---
    function triggerFileExport(data, filename, type) {
        const isNative = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.exportFile;
        
        if (isNative) {
            // NATIVE PATH: Send to Swift Cocoa bridge
            if (type === 'canvas') {
                const base64 = data.toDataURL('image/png').split(',')[1];
                window.webkit.messageHandlers.exportFile.postMessage({ filename, base64 });
                updateStatus(`Export Success: Sprite sheet saved via macOS native bridge.`);
            } else if (type === 'blob') {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result.split(',')[1];
                    window.webkit.messageHandlers.exportFile.postMessage({ filename, base64 });
                    updateStatus(`Export Success: Diagnostic loop saved via macOS native bridge.`);
                };
                reader.readAsDataURL(data);
            } else if (type === 'string') {
                const base64 = btoa(unescape(encodeURIComponent(data)));
                window.webkit.messageHandlers.exportFile.postMessage({ filename, base64 });
                updateStatus(`Export Success: Playtest sandbox saved via macOS native bridge.`);
            }
        } else {
            // WEB PATH: Graceful browser fallback with DOM-appended link elements
            const link = document.createElement('a');
            link.download = filename;
            
            if (type === 'canvas') {
                data.toBlob((blob) => {
                    link.href = URL.createObjectURL(blob);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    updateStatus('Export Success: Sprite sheet atlas PNG generated.');
                }, 'image/png');
            } else if (type === 'blob') {
                link.href = URL.createObjectURL(data);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                updateStatus('Export Success: Diagnostic transparency looping GIF generated.');
            } else if (type === 'string') {
                const blob = new Blob([data], { type: 'text/html' });
                link.href = URL.createObjectURL(blob);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                updateStatus('Export Success: Portable HTML5 Canvas playtest sandbox compiled.');
            }
        }
    }

    // ==========================================================================
    // EXPORTER ACTIONS: PNG Texture Atlas, Looping GIF, Playtest Sandbox
    // ==========================================================================

    els.btnExportPng.addEventListener('click', () => {
        if (!state.compiledSheetCanvas) return;
        
        renderCompiledAtlas(); // Ensure latest sync
        triggerFileExport(state.compiledSheetCanvas, 'dex_spritesheet.png', 'canvas');
    });

    els.btnExportGif.addEventListener('click', () => {
        if (!state.activeSlices.length) return;
        
        updateStatus('Compiling diagnostic looping GIF...');
        
        // Process active frames as individual paletted grid canvas pixels
        const framesData = [];
        const w = state.spriteW;
        const h = state.spriteH;
        
        state.activeSlices.forEach(slice => {
            const cellCanvas = document.createElement('canvas');
            cellCanvas.width = w;
            cellCanvas.height = h;
            const cellCtx = cellCanvas.getContext('2d');
            
            quantizeSliceFrame(slice, cellCtx);
            
            const imgData = cellCtx.getImageData(0, 0, w, h);
            framesData.push(imgData.data);
        });
        
        // Run customized lightweight GIF Encoder natively
        const delayHundredths = Math.round(100 / state.fps);
        const gifBytes = encodeGifLoop(w, h, framesData, state.masterPalette, delayHundredths);
        
        const blob = new Blob([gifBytes], { type: 'image/gif' });
        triggerFileExport(blob, 'dex_playback_loop.gif', 'blob');
    });

    els.btnExportHtml.addEventListener('click', () => {
        if (!state.activeSlices.length || !state.compiledSheetCanvas) return;
        
        updateStatus('Packaging HTML5 Playtest Sandbox...');
        
        // Extract size configurations
        const cellW = state.spriteW;
        const cellH = state.spriteH;
        const padding = state.padding;
        const numFrames = state.activeSlices.length;
        const cols = Math.ceil(Math.sqrt(numFrames));
        
        // Build sprite atlas sheet coordinates
        const frameCoordinates = [];
        state.activeSlices.forEach((slice, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            
            const px = (col * cellW) + (padding * (col + 1));
            const py = (row * cellH) + (padding * (row + 1));
            
            frameCoordinates.push({ x: px, y: py });
        });
        
        const sandboxHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dex Sprite HTML5 Sandbox Playtester</title>
    <style>
        body {
            background-color: #08080A;
            color: #FFFFFF;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            overflow: hidden;
        }
        h1 {
            font-size: 26px;
            font-weight: 800;
            margin-bottom: 4px;
            background: linear-gradient(135deg, #007AFF 0%, #30D158 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .desc {
            color: #8E8E93;
            font-size: 13px;
            margin-bottom: 30px;
        }
        .sandbox-card {
            background: rgba(20, 20, 24, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(15px);
            padding: 35px;
            border-radius: 20px;
            box-shadow: 0 15px 45px rgba(0,0,0,0.6);
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        canvas {
            background-image: 
                linear-gradient(45deg, #151518 25%, transparent 25%), 
                linear-gradient(-45deg, #151518 25%, transparent 25%), 
                linear-gradient(45deg, transparent 75%, #151518 75%), 
                linear-gradient(-45deg, transparent 75%, #151518 75%);
            background-size: 20px 20px;
            background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
            background-color: #0E0E10;
            border-radius: 12px;
            margin-bottom: 25px;
            image-rendering: pixelated;
            border: 1px solid #2C2C2E;
        }
        .controls-deck {
            display: flex;
            gap: 25px;
            align-items: center;
        }
        .btn {
            background: #007AFF;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 122, 255, 0.25);
            transition: all 0.2s;
        }
        .btn:hover {
            background: #359AFF;
            transform: translateY(-1px);
        }
        .slider-group {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            min-width: 180px;
        }
        label {
            font-size: 10px;
            color: #8E8E93;
            margin-bottom: 5px;
            font-weight: 700;
            text-transform: uppercase;
        }
        input[type="range"] {
            width: 100%;
            cursor: pointer;
            accent-color: #007AFF;
        }
    </style>
</head>
<body>

    <h1>DEX SPRITE PLAYTEST PLAYGROUND</h1>
    <div class="desc">Direct HTML5 Canvas Frame Execution Engine</div>

    <div class="sandbox-card">
        <canvas id="gameCanvas" width="${cellW * 8}" height="${cellH * 8}"></canvas>
        <div class="controls-deck">
            <button class="btn" id="playBtn">Pause</button>
            <div class="slider-group">
                <label id="fpsLabel">SPEED: ${state.fps} FPS</label>
                <input type="range" id="fpsRange" min="1" max="30" value="${state.fps}">
            </div>
        </div>
    </div>

    <script>
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false; // direct nearest-neighbor boundaries

        // Embed the spritesheet image directly as a base64 asset to prevent CORS issues
        const spriteSheet = new Image();
        spriteSheet.src = '${state.compiledSheetCanvas.toDataURL("image/png")}';

        const frames = ${JSON.stringify(frameCoordinates)};
        const cellW = ${cellW};
        const cellH = ${cellH};
        
        let currentFrameIndex = 0;
        let isPlaying = true;
        let fps = ${state.fps};
        let lastFrameTime = 0;

        spriteSheet.onload = () => {
            requestAnimationFrame(gameLoop);
        };

        function gameLoop(time) {
            if (!isPlaying) {
                requestAnimationFrame(gameLoop);
                return;
            }

            const delta = time - lastFrameTime;
            const interval = 1000 / fps;

            if (delta >= interval) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                const frame = frames[currentFrameIndex];
                
                // Draw sprite scaled sharply
                ctx.drawImage(
                    spriteSheet,
                    frame.x, frame.y, cellW, cellH, 
                    0, 0, canvas.width, canvas.height 
                );
                
                currentFrameIndex = (currentFrameIndex + 1) % frames.length;
                lastFrameTime = time - (delta % interval);
            }
            
            requestAnimationFrame(gameLoop);
        }

        // Interface controls bindings
        const playBtn = document.getElementById('playBtn');
        playBtn.addEventListener('click', () => {
            isPlaying = !isPlaying;
            playBtn.textContent = isPlaying ? 'Pause' : 'Play';
        });

        const fpsRange = document.getElementById('fpsRange');
        const fpsLabel = document.getElementById('fpsLabel');
        fpsRange.addEventListener('input', (e) => {
            fps = parseInt(e.target.value);
            fpsLabel.textContent = "SPEED: " + fps + " FPS";
        });
    </script>
</body>
</html>`;

        triggerFileExport(sandboxHtml, 'dex_playtest_sandbox.html', 'string');
    });

    // ==========================================================================
    // PURE JAVASCRIPT TRANSPARENT looping GIF ENCODER (LZW compliant)
    // ==========================================================================

    function encodeGifLoop(width, height, frames, masterPalette, delayHundredths) {
        const bytes = [];
        
        // 1. Header: GIF89a
        writeString(bytes, 'GIF89a');
        
        // 2. Logical Screen Descriptor
        writeWord(bytes, width);  // Logical Screen Width
        writeWord(bytes, height); // Logical Screen Height
        
        // Packed Fields: Global Color Table Present (1), 7 Color Resolution, 0 Sort, 7 Table Size (256 entries)
        bytes.push(0xF7); 
        bytes.push(0x00); // Background Color Index (0)
        bytes.push(0x00); // Pixel Aspect Ratio (0)
        
        // 3. Global Color Table (GCT) — 256 colors * 3 RGB values
        for (let i = 0; i < 256; i++) {
            const color = masterPalette[i] || [0, 0, 0];
            bytes.push(color[0]); // R
            bytes.push(color[1]); // G
            bytes.push(color[2]); // B
        }
        
        // 4. Netscape Application Looping Extension (infinite looping block)
        bytes.push(0x21); // Extension Introducer
        bytes.push(0xFF); // Application Extension Label
        bytes.push(0x0B); // Block Size (11 bytes)
        writeString(bytes, 'NETSCAPE2.0');
        bytes.push(0x03); // Sub-block size (3 bytes)
        bytes.push(0x01); // Loop flag (1)
        writeWord(bytes, 0); // Loop count (0 = infinite)
        bytes.push(0x00); // Block Terminator
        
        // 5. Sequential Animation Frames
        frames.forEach(rgbaData => {
            // Graphic Control Extension (specifies transparency & delays)
            bytes.push(0x21); // Extension Introducer
            bytes.push(0xF9); // Graphic Control Label
            bytes.push(0x04); // Block Size (4 bytes)
            
            // Packed Fields: 0 Reserved, 2 Disposal Method (restore to background), 0 Input, 1 Transparency flag
            bytes.push(0x09); 
            writeWord(bytes, delayHundredths); // Frame tick delay
            bytes.push(0x0F); // Transparent index color pointer (Color #15 is transparency)
            bytes.push(0x00); // Block Terminator
            
            // Image Descriptor
            bytes.push(0x2C); // Image Separator
            writeWord(bytes, 0); // Image Left position
            writeWord(bytes, 0); // Image Top position
            writeWord(bytes, width);  // Image Width
            writeWord(bytes, height); // Image Height
            bytes.push(0x00); // Packed Fields: Local Color Table flag (0)
            
            // Map Frame RGBA pixels directly to Global Palette indices (0 to 15)
            const indexPixels = new Uint8Array(width * height);
            for (let i = 0; i < rgbaData.length; i += 4) {
                const r = rgbaData[i];
                const g = rgbaData[i+1];
                const b = rgbaData[i+2];
                const a = rgbaData[i+3];
                const pixelIdx = i / 4;
                
                if (a < 128) {
                    indexPixels[pixelIdx] = 15; // Hard lock transparent color index
                } else {
                    indexPixels[pixelIdx] = findPaletteIndex(r, g, b, masterPalette);
                }
            }
            
            // LZW Compress index pixels and output stream blocks
            compressLZW(bytes, indexPixels);
        });
        
        // 6. Trailer End Symbol
        bytes.push(0x3B);
        
        return new Uint8Array(bytes);
    }

    function findPaletteIndex(r, g, b, masterPalette) {
        let minDist = Infinity;
        let matchedIdx = 0;
        
        // Scan active colors 0 to 14 strictly
        for (let i = 0; i < 15; i++) {
            const pal = masterPalette[i];
            const dist = Math.pow(r - pal[0], 2) + Math.pow(g - pal[1], 2) + Math.pow(b - pal[2], 2);
            if (dist < minDist) {
                minDist = dist;
                matchedIdx = i;
            }
        }
        return matchedIdx;
    }

    // --- Fast uncompressed LZW encoding engine for perfect client-side GIF downloads ---
    function compressLZW(bytes, pixels) {
        const minCodeSize = 8;
        bytes.push(minCodeSize); // Code Size indicator byte
        
        const clearCode = 1 << minCodeSize; // 256
        const eoiCode = clearCode + 1;      // 257
        
        // Accumulator bit packer buffer
        let bitBuffer = 0;
        let bitLength = 0;
        const subBlock = [];
        
        function writeCode(code, size) {
            bitBuffer |= (code << bitLength);
            bitLength += size;
            
            while (bitLength >= 8) {
                subBlock.push(bitBuffer & 0xFF);
                bitBuffer >>= 8;
                bitLength -= 8;
                
                if (subBlock.length === 255) {
                    flushSubBlock();
                }
            }
        }
        
        function flushSubBlock() {
            if (subBlock.length === 0) return;
            bytes.push(subBlock.length);
            for (let i = 0; i < subBlock.length; i++) {
                bytes.push(subBlock[i]);
            }
            subBlock.length = 0;
        }
        
        // Write standard Clear Code first
        writeCode(clearCode, minCodeSize + 1);
        
        // Write each pixel index (0-255) as standard codes
        for (let i = 0; i < pixels.length; i++) {
            writeCode(pixels[i], minCodeSize + 1);
        }
        
        // Write EOI code to terminate stream
        writeCode(eoiCode, minCodeSize + 1);
        
        // Flush remaining bits in packers
        if (bitLength > 0) {
            subBlock.push(bitBuffer & 0xFF);
        }
        flushSubBlock();
        
        bytes.push(0x00); // Stream block terminator
    }

    function writeString(bytes, str) {
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }
    }

    function writeWord(bytes, word) {
        bytes.push(word & 0xFF);
        bytes.push((word >> 8) & 0xFF);
    }

    // --- Advanced UI/UX Audio Synthesizer Engine ---
    let audioCtx = null;

    function playSynthSFX(type) {
        if (!state.sfxEnabled) return;
        
        try {
            // Lazy-init AudioContext to bypass modern browser autostart policies
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            const now = audioCtx.currentTime;
            
            switch (type) {
                case 'click': // Crisp short retro chip click
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(600, now);
                    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                    osc.start(now);
                    osc.stop(now + 0.08);
                    break;
                case 'pop': // Short 8-bit visual pop
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(150, now);
                    osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);
                    gain.gain.setValueAtTime(0.2, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                    osc.start(now);
                    osc.stop(now + 0.12);
                    break;
                case 'coin': // Magical crystal 8-bit coin chime
                    osc.type = 'square';
                    // Classic NES two-note sound
                    osc.frequency.setValueAtTime(987.77, now); // B5
                    osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.setValueAtTime(0.1, now + 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                    osc.start(now);
                    osc.stop(now + 0.35);
                    break;
                case 'success': // Rising major chord scale chime
                    osc.type = 'triangle';
                    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                    notes.forEach((freq, index) => {
                        osc.frequency.setValueAtTime(freq, now + index * 0.07);
                    });
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.setValueAtTime(0.15, now + 0.21);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                    osc.start(now);
                    osc.stop(now + 0.4);
                    break;
                case 'drop': // Dynamic pitch drop on cell deletion/active-toggle
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(300, now);
                    osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    osc.start(now);
                    osc.stop(now + 0.15);
                    break;
                case 'swoosh': // Slide/minor adjustment tick
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(400, now);
                    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                    osc.start(now);
                    osc.stop(now + 0.06);
                    break;
            }
        } catch (err) {
            console.warn('AudioContext failed to initialize:', err);
        }
    }

    // --- Smart Magic Auto-Slice Transparency Scanner ---
    function runMagicAutoSlice() {
        if (!state.sourceImage || !state.slices.length) return;
        
        let scannedCount = 0;
        let emptyCount = 0;
        
        const w = state.spriteW;
        const h = state.spriteH;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        
        state.slices.forEach(slice => {
            scannedCount++;
            tempCtx.clearRect(0, 0, w, h);
            tempCtx.drawImage(
                state.sourceImage,
                slice.x, slice.y, w, h,
                0, 0, w, h
            );
            
            const imgData = tempCtx.getImageData(0, 0, w, h);
            const data = imgData.data;
            
            let isOpaque = false;
            // Scan color alpha thresholds in each cell grid (alpha > 15 avoids compression noise)
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] > 15) {
                    isOpaque = true;
                    break;
                }
            }
            
            if (!isOpaque) {
                slice.active = false;
                emptyCount++;
            }
        });
        
        sliceAndRecompute();
        playSynthSFX('success');
        showToast(`Auto-Slice Complete: Scanned ${scannedCount} frames, filtered ${emptyCount} empty/transparent cells!`);
    }

    // --- Advanced Interactive Features Initializer ---
    function initAdvancedFeatures() {
        // 1. Theme Switcher Initializer
        const savedTheme = localStorage.getItem('dex-sprite-theme') || 'cyber-neon';
        state.theme = savedTheme;
        if (els.themeSelect) {
            els.themeSelect.value = savedTheme;
        }
        document.body.className = `theme-${savedTheme}`;
        if (window.isNativeApp) {
            document.body.classList.add('native-app');
        }

        if (els.themeSelect) {
            els.themeSelect.addEventListener('change', (e) => {
                const selectedTheme = e.target.value;
                state.theme = selectedTheme;
                document.body.className = `theme-${selectedTheme}`;
                if (window.isNativeApp) {
                    document.body.classList.add('native-app');
                }
                localStorage.setItem('dex-sprite-theme', selectedTheme);
                playSynthSFX('coin');
            });
        }

        // 2. Retro SFX Switch
        const savedSFX = localStorage.getItem('dex-sprite-sfx') === 'true';
        state.sfxEnabled = savedSFX;
        if (els.chkRetroSfx) {
            els.chkRetroSfx.checked = savedSFX;
            els.chkRetroSfx.addEventListener('change', (e) => {
                state.sfxEnabled = e.target.checked;
                localStorage.setItem('dex-sprite-sfx', state.sfxEnabled);
                if (state.sfxEnabled) {
                    // Try to lazy-initialize and play coin sound immediately on enabling
                    if (!audioCtx) {
                        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    if (audioCtx.state === 'suspended') {
                        audioCtx.resume();
                    }
                    playSynthSFX('coin');
                }
            });
        }

        // 3. Onion Skin Switch
        const savedOnion = localStorage.getItem('dex-sprite-onion') === 'true';
        state.onionSkinEnabled = savedOnion;
        if (els.chkOnionSkin) {
            els.chkOnionSkin.checked = savedOnion;
            els.chkOnionSkin.addEventListener('change', (e) => {
                state.onionSkinEnabled = e.target.checked;
                localStorage.setItem('dex-sprite-onion', state.onionSkinEnabled);
                playSynthSFX('click');
                if (state.sourceImage) {
                    renderPlaybackViewport();
                }
            });
        }

        // 4. Smart Magic Auto-Slice Button
        if (els.btnMagicSlice) {
            els.btnMagicSlice.addEventListener('click', () => {
                if (!state.sourceImage) {
                    showToast('Please upload a sprite sheet first');
                    return;
                }
                runMagicAutoSlice();
            });
        }
    }

    // Run initializer immediately
    initAdvancedFeatures();
});
