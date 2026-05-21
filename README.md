# Dex Sprite — Premium Retro Asset Compiler & Workspace

Dex Sprite is an offline-first, high-density professional retro graphics utility optimized to compile high-resolution animation sequences and consolidated sheets into hardware-accurate Super Nintendo (SNES) sprite sheets, looping diagnostic GIFs, and instant HTML5 playtest code.

This utility is available in two paradigms:
1. **🌟 Premium Browser Portal (Recommended)**: A beautiful, state-of-the-art Single Page Application (`index.html` + `app.js` + `style.css`) that runs 100% locally in Safari/Chrome. It features a drag-and-drop workspace, visual grid slicer, interactive click-to-toggle cells, and offline JS compilers.
2. **🐍 Python Desktop Client**: A traditional macOS desktop application (`src/app.py` in Tkinter + PIL) optimized for local sequence folders.

---

## 🌟 Premium Browser Workspace Features

* **Drag-and-Drop Image Uploader**: Drag any sprite sheet grid or strip image directly into the browser.
* **Interactive Grid Slicer**: Clicking on cells inside the grid dynamically includes or excludes them from the compilation pipeline (excluded cells are dimmed with a beautiful red crossing mask).
* **Mac Mode Glassmorphism**: Frosted layouts, glowing focus outlines, smooth hover transitions, and native Apple system font rendering.
* **Crisp Pixel canvases**: Nearest-neighbor scaling ensures sprite sheets and loops are drawn with perfect retro boundaries.
* **15-Bit SNES Quantization**: Median-cut color clustering, 15-bit color channel clamping, and locking Index 15 as transparent Magenta (`#FF00FF`).
* **Ordered Dithering**: Floyd-Steinberg error diffusion and Bayer 4x4 matrix ordered dithering.
* **Drift Alignment Player**: Loop previews pause automatically on click-drag, allowing you to slide frame offsets relative to a red target crosshair.
* **Local Exporters**: Save indexed PNGs, generate transparent diagnostic GIFs, and package portable playtest sandboxes completely offline.

---

## 📂 Directory Workspace Structure

```
DexSprite/
├── index.html                            # Premium Web Application Workspace
├── style.css                             # Custom macOS dark styles & animations
├── app.js                                # Offline slice compiler & GIF generator
├── Dex Sprite Master Specification.txt   # Core specifications
├── requirements.txt                      # Python library dependencies
├── README.md                             # This documentation
└── src/
    └── app.py                            # Python desktop client alternative
```

---

## 🎮 Running the Web Application (Recommended)

1. Navigate to the project folder in **Finder**:
   `/Users/andrew/Library/Mobile Documents/com~apple~CloudDocs/Projects/DexSprite`
2. **Double-click `index.html`** to open it instantly in Safari, Chrome, or your favorite web browser.
3. Drag any sprite sheet or consolidated graphic file directly into the **Drag & Drop** area.
4. Customize your sprite cell sizes, select dither styles, click grid cells to exclude them, adjust timeline offsets, and download your retro assets!

---

## 🐍 Running the Python Client (Alternative)

To run the Tkinter desktop client using your local virtual environment:

### Step 1: Activate Sandbox
```bash
cd "/Users/andrew/Library/Mobile Documents/com~apple~CloudDocs/Projects/DexSprite"
source venv/bin/activate
```

### Step 2: Install Pillow
```bash
pip install -r requirements.txt
```

### Step 3: Launch
```bash
python3 src/app.py
```

---

## 🔬 Slicing & Alignment Workflow

1. **Load Asset**: Drag a combined sheet into the **Web App** (or select a folder of sequential frames in the **Python App**).
2. **Grid Slice**: Choose the slice boundaries (`16x16`, `16x32`, `32x32`, `64x64`). The web app overlays a grid. Click on any blank/empty cells to disable them!
3. **Align Drifts**: In the **Drift Alignment Editor** viewport, click and drag to slide individual frames until they are aligned perfectly with the red crosshair.
4. **Select Shading**: Switch between Floyd-Steinberg error diffusion or Bayer 4x4 mesh dither to give your sprites a beautiful retro shadow.
5. **Download Assets**: Save your indexed PNG sheet, looping GIF, or the self-contained HTML5 playtest sandbox file!

