import os
import math
import sys
import gc
import json
import tkinter as tk
from tkinter import filedialog, messagebox
from PIL import Image, ImageTk, ImageDraw

class DexSpriteApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Dex Sprite — Retro Asset Compiler")
        self.root.geometry("1200x850")
        self.root.minsize(1050, 750)
        
        # macOS Premium Dark Mode Color Tokens
        self.bg_color = "#121212"         # Deep canvas background
        self.panel_color = "#1C1C1E"      # Elevated panel card bg
        self.panel_header_color = "#2C2C2E" # Darker header backgrounds
        self.accent_color = "#0A84FF"     # Apple System Blue
        self.accent_hover = "#359AFF"     # Lighter blue for hover
        self.success_color = "#30D158"    # Apple System Green
        self.success_hover = "#40E068"
        self.warning_color = "#FF9F0A"    # Apple System Orange
        self.warning_hover = "#FFAF33"
        self.danger_color = "#FF453A"     # Apple System Red
        self.danger_hover = "#FF6961"
        self.text_color = "#FFFFFF"       # High-contrast white
        self.muted_text = "#8E8E93"       # Muted gray labels
        self.border_color = "#2C2C2E"     # Fine border strokes
        self.checker_dark1 = "#1A1A1A"
        self.checker_dark2 = "#141414"
        
        self.root.configure(bg=self.bg_color)
        
        # Engine State Management
        self.source_dir = ""
        self.frames_list = []       # Original sequential system paths
        self.active_frames = []     # List of Boolean values for frame toggles
        self.offsets = []           # List of (dx, dy) tuples for manual pivot adjustment
        self.processed_frames = []  # Clamped paletted PIL Images (with transparency mapped to 15)
        self.master_palette = []    # Clamped 15-bit retro RGB palette (768 bytes total)
        self.sprite_sheet_img = None
        
        # UI Image Holders (to prevent garbage collection)
        self.atlas_photo = None
        self.preview_photo = None
        self.preview_tk_images = [] # Active viewable RGBA images (including inactive greying)
        
        # Viewport Display States
        self.current_frame_index = 0
        self.drag_start_x = 0
        self.drag_start_y = 0
        
        # Looped Diagnostic Playback Controls
        self.is_playing = True
        self.animation_job = None
        
        self.build_ui()
        
    def build_ui(self):
        # Configure Root Grid Weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(1, weight=1)
        
        # --- Upper Title Header Panel ---
        top_panel = tk.Frame(self.root, bg=self.panel_color, height=60, bd=0)
        top_panel.grid(row=0, column=0, columnspan=2, sticky="ew")
        top_panel.pack_propagate(False)
        
        # Sub-border
        bottom_stroke = tk.Frame(top_panel, bg=self.border_color, height=1)
        bottom_stroke.pack(side="bottom", fill="x")
        
        title_lbl = tk.Label(top_panel, text="DEX'S SPRITE", font=("SF Pro Display", 18, "bold"), fg=self.text_color, bg=self.panel_color)
        title_lbl.pack(side="left", padx=(25, 10), pady=(5, 5))
        
        info_lbl = tk.Label(top_panel, text="Retro Asset Engine • Zero-AI Stability Pipeline", font=("SF Pro Text", 10), fg=self.muted_text, bg=self.panel_color)
        info_lbl.pack(side="left", padx=0, pady=(10, 5))
        
        # --- Core Application Split-Screen Layout ---
        workspace = tk.Frame(self.root, bg=self.bg_color)
        workspace.grid(row=1, column=0, sticky="nsew", padx=20, pady=(20, 10))
        workspace.columnconfigure(0, weight=3) # Left viewports
        workspace.columnconfigure(1, weight=1) # Right configuration panel
        workspace.rowconfigure(0, weight=1)
        
        # Viewports Frame (Left Side)
        viewports_frame = tk.Frame(workspace, bg=self.bg_color)
        viewports_frame.grid(row=0, column=0, sticky="nsew")
        viewports_frame.columnconfigure(0, weight=1)
        viewports_frame.columnconfigure(1, weight=1)
        viewports_frame.rowconfigure(0, weight=1)
        
        # Left Viewport: Texture Atlas Sheet Compiler
        self.atlas_container = tk.LabelFrame(viewports_frame, text=" Compiled Texture Atlas Preview ", fg=self.text_color, bg=self.panel_color, bd=1, relief="flat", font=("SF Pro Text", 12, "bold"))
        self.atlas_container.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        self.atlas_container.columnconfigure(0, weight=1)
        self.atlas_container.rowconfigure(0, weight=1)
        
        self.atlas_canvas = tk.Canvas(self.atlas_container, bg=self.checker_dark2, bd=0, highlightthickness=0)
        self.atlas_canvas.grid(row=0, column=0, sticky="nsew", padx=12, pady=12)
        
        # Right Viewport: Live Alignment Editor
        self.preview_container = tk.LabelFrame(viewports_frame, text=" Live Registration Alignment Editor ", fg=self.text_color, bg=self.panel_color, bd=1, relief="flat", font=("SF Pro Text", 12, "bold"))
        self.preview_container.grid(row=0, column=1, sticky="nsew", padx=(10, 0))
        self.preview_container.columnconfigure(0, weight=1)
        self.preview_container.rowconfigure(0, weight=1)
        
        self.preview_canvas = tk.Canvas(self.preview_container, bg=self.checker_dark2, bd=0, highlightthickness=0)
        self.preview_canvas.grid(row=0, column=0, sticky="nsew", padx=12, pady=12)
        
        # Bind interactive mouse dragging behaviors for registration
        self.preview_canvas.bind("<ButtonPress-1>", self.start_registration_drag)
        self.preview_canvas.bind("<B1-Motion>", self.execute_registration_drag)
        
        # --- Right Control & Parameter Panel ---
        controls_card = tk.Frame(workspace, bg=self.panel_color, width=340, bd=0)
        controls_card.grid(row=0, column=1, sticky="nsew", padx=(20, 0))
        controls_card.pack_propagate(False)
        
        # Header Section
        panel_hdr = tk.Frame(controls_card, bg=self.panel_header_color, height=45)
        panel_hdr.pack(fill="x")
        panel_hdr_lbl = tk.Label(panel_hdr, text="PIPELINE COMPILER OPTIONS", font=("SF Pro Text", 11, "bold"), fg=self.text_color, bg=self.panel_header_color)
        panel_hdr_lbl.pack(side="left", padx=15)
        
        # Folder Loader Block
        dir_lbl = tk.Label(controls_card, text="SOURCE DIRECTORY", font=("SF Pro Text", 9, "bold"), fg=self.muted_text, bg=self.panel_color)
        dir_lbl.pack(anchor="w", padx=15, pady=(15, 5))
        
        self.btn_select_dir = tk.Button(controls_card, text="📂 Load Frame Sequence Folder", bg=self.accent_color, fg="white", highlightbackground=self.panel_color, relief="flat", font=("SF Pro Text", 11, "bold"), command=self.load_directory)
        self.btn_select_dir.pack(fill="x", padx=15)
        self.bind_hover(self.btn_select_dir, self.accent_hover, self.accent_color)
        
        self.lbl_selected_dir = tk.Label(controls_card, text="No active directory loaded. Select a folder of sequential PNG/JPG sprites.", font=("SF Pro Text", 10), fg=self.muted_text, bg=self.panel_color, wraplength=300, justify="left")
        self.lbl_selected_dir.pack(anchor="w", padx=15, pady=(8, 12))
        
        sep1 = tk.Frame(controls_card, bg=self.border_color, height=1)
        sep1.pack(fill="x", padx=15, pady=5)
        
        # Dimension Clamping Selector
        dim_lbl = tk.Label(controls_card, text="SPRITE CELL SIZE (SNES BOUNDS)", font=("SF Pro Text", 9, "bold"), fg=self.muted_text, bg=self.panel_color)
        dim_lbl.pack(anchor="w", padx=15, pady=(10, 5))
        
        self.size_var = tk.StringVar(value="32x32")
        sizes = [
            ("16 x 16 Standard Block", "16x16"), 
            ("16 x 32 Platformer Frame", "16x32"), 
            ("32 x 32 Large Sprite", "32x32"), 
            ("64 x 64 Boss / Giant scale", "64x64")
        ]
        for text, val in sizes:
            rb = tk.Radiobutton(controls_card, text=text, variable=self.size_var, value=val, fg=self.text_color, bg=self.panel_color, selectcolor=self.bg_color, activebackground=self.panel_color, activeforeground=self.text_color, font=("SF Pro Text", 10), command=self.recompute)
            rb.pack(anchor="w", padx=25, pady=2)
            
        sep2 = tk.Frame(controls_card, bg=self.border_color, height=1)
        sep2.pack(fill="x", padx=15, pady=8)
        
        # Color Dithering Algorithm Selector
        dither_lbl = tk.Label(controls_card, text="COLOR QUANTIZATION DITHER", font=("SF Pro Text", 9, "bold"), fg=self.muted_text, bg=self.panel_color)
        dither_lbl.pack(anchor="w", padx=15, pady=(5, 5))
        
        self.dither_var = tk.StringVar(value="none")
        dithers = [
            ("None (Clean Retro Palette Map)", "none"), 
            ("Floyd-Steinberg (Error Diffusion)", "floyd"), 
            ("Bayer 4x4 (Halftone Mesh Pattern)", "bayer")
        ]
        for text, val in dithers:
            rb = tk.Radiobutton(controls_card, text=text, variable=self.dither_var, value=val, fg=self.text_color, bg=self.panel_color, selectcolor=self.bg_color, activebackground=self.panel_color, activeforeground=self.text_color, font=("SF Pro Text", 10), command=self.recompute)
            rb.pack(anchor="w", padx=25, pady=2)
            
        sep3 = tk.Frame(controls_card, bg=self.border_color, height=1)
        sep3.pack(fill="x", padx=15, pady=8)
        
        # Bleed Guard Separator Margins
        pad_lbl = tk.Label(controls_card, text="CELL SPACE BLEED GUARD", font=("SF Pro Text", 9, "bold"), fg=self.muted_text, bg=self.panel_color)
        pad_lbl.pack(anchor="w", padx=15, pady=(5, 5))
        
        self.pad_var = tk.IntVar(value=1)
        paddings = [
            ("0 px Margin (Tight Sheet)", 0), 
            ("1 px Standard Gutter (Safe)", 1), 
            ("2 px Double Bleed Gutter", 2)
        ]
        for text, val in paddings:
            rb = tk.Radiobutton(controls_card, text=text, variable=self.pad_var, value=val, fg=self.text_color, bg=self.panel_color, selectcolor=self.bg_color, activebackground=self.panel_color, activeforeground=self.text_color, font=("SF Pro Text", 10), command=self.recompute)
            rb.pack(anchor="w", padx=25, pady=2)
            
        sep4 = tk.Frame(controls_card, bg=self.border_color, height=1)
        sep4.pack(fill="x", padx=15, pady=8)
        
        # Engine speed slider
        fps_lbl = tk.Label(controls_card, text="DIAGNOSTIC PLAYBACK SPEED", font=("SF Pro Text", 9, "bold"), fg=self.muted_text, bg=self.panel_color)
        fps_lbl.pack(anchor="w", padx=15, pady=(5, 5))
        
        self.fps_var = tk.IntVar(value=10)
        self.fps_slider = tk.Scale(controls_card, from_=1, to=30, orient="horizontal", variable=self.fps_var, bg=self.panel_color, fg=self.text_color, highlightbackground=self.panel_color, activebackground=self.accent_color, font=("SF Pro Text", 10), command=self.on_fps_change)
        self.fps_slider.pack(fill="x", padx=25, pady=(0, 10))
        
        # Export Actions Panel
        self.btn_compile = tk.Button(controls_card, text="💾 Export Sprite Sheet (PNG)", bg=self.success_color, fg="white", highlightbackground=self.panel_color, font=("SF Pro Text", 11, "bold"), relief="flat", state="disabled", command=self.export_png)
        self.btn_compile.pack(fill="x", padx=15, pady=(15, 4))
        self.bind_hover(self.btn_compile, self.success_hover, self.success_color)
        
        self.btn_export_gif = tk.Button(controls_card, text="🎥 Export Diagnostic Loop (GIF)", bg=self.warning_color, fg="white", highlightbackground=self.panel_color, font=("SF Pro Text", 11, "bold"), relief="flat", state="disabled", command=self.export_gif)
        self.btn_export_gif.pack(fill="x", padx=15, pady=4)
        self.bind_hover(self.btn_export_gif, self.warning_hover, self.warning_color)
        
        self.btn_export_html = tk.Button(controls_card, text="🌐 Export HTML5 Playtest Sandbox", bg=self.accent_color, fg="white", highlightbackground=self.panel_color, font=("SF Pro Text", 11, "bold"), relief="flat", state="disabled", command=self.export_html5)
        self.btn_export_html.pack(fill="x", padx=15, pady=(4, 15))
        self.bind_hover(self.btn_export_html, self.accent_hover, self.accent_color)
        
        # --- Bottom Timeline Status Deck ---
        bottom_panel = tk.Frame(self.root, bg=self.panel_color, height=110, bd=0)
        bottom_panel.grid(row=2, column=0, columnspan=2, sticky="ew")
        bottom_panel.pack_propagate(False)
        
        # Sub-border
        top_stroke = tk.Frame(bottom_panel, bg=self.border_color, height=1)
        top_stroke.pack(side="top", fill="x")
        
        # Text Information Column
        txt_frame = tk.Frame(bottom_panel, bg=self.panel_color)
        txt_frame.pack(side="left", fill="both", expand=True, padx=25, pady=10)
        
        self.status_var = tk.StringVar(value="System Active. Please select an input folder of sequential animation frames to begin.")
        self.status_lbl = tk.Label(txt_frame, textvariable=self.status_var, font=("SF Pro Text", 11, "bold"), fg=self.text_color, bg=self.panel_color, justify="left", anchor="w")
        self.status_lbl.pack(side="top", anchor="w", pady=(8, 4))
        
        self.frame_info_var = tk.StringVar(value="Frame Track: No data loaded.")
        self.frame_info_lbl = tk.Label(txt_frame, textvariable=self.frame_info_var, font=("SF Pro Text", 10, "italic"), fg=self.muted_text, bg=self.panel_color, justify="left", anchor="w")
        self.frame_info_lbl.pack(side="top", anchor="w")
        
        # Interactive Diagnostic Timeline Dashboard (Right aligned in bottom deck)
        self.deck_controls = tk.Frame(bottom_panel, bg=self.panel_color)
        self.deck_controls.pack(side="right", fill="y", padx=25, pady=10)
        
        # Deck Buttons
        self.btn_prev = tk.Button(self.deck_controls, text="⏮ Prev", bg=self.panel_header_color, fg=self.text_color, highlightbackground=self.panel_color, relief="flat", font=("SF Pro Text", 10, "bold"), state="disabled", command=self.step_prev_frame)
        self.btn_prev.pack(side="left", padx=3)
        self.bind_hover(self.btn_prev, "#3A3A3C", self.panel_header_color)
        
        self.btn_play_pause = tk.Button(self.deck_controls, text="⏸ Pause", bg=self.accent_color, fg="white", highlightbackground=self.panel_color, relief="flat", font=("SF Pro Text", 10, "bold"), state="disabled", command=self.toggle_play_pause)
        self.btn_play_pause.pack(side="left", padx=3)
        self.bind_hover(self.btn_play_pause, self.accent_hover, self.accent_color)
        
        self.btn_next = tk.Button(self.deck_controls, text="Next ⏭", bg=self.panel_header_color, fg=self.text_color, highlightbackground=self.panel_color, relief="flat", font=("SF Pro Text", 10, "bold"), state="disabled", command=self.step_next_frame)
        self.btn_next.pack(side="left", padx=3)
        self.bind_hover(self.btn_next, "#3A3A3C", self.panel_header_color)
        
        self.btn_toggle_active = tk.Button(self.deck_controls, text="Toggle Active", bg=self.danger_color, fg="white", highlightbackground=self.panel_color, relief="flat", font=("SF Pro Text", 10, "bold"), state="disabled", command=self.toggle_frame_active)
        self.btn_toggle_active.pack(side="left", padx=(15, 3))
        self.bind_hover(self.btn_toggle_active, self.danger_hover, self.danger_color)
        
    def bind_hover(self, button, hover_bg, normal_bg):
        button.bind("<Enter>", lambda e: button.configure(bg=hover_bg) if button["state"] == "normal" else None)
        button.bind("<Leave>", lambda e: button.configure(bg=normal_bg) if button["state"] == "normal" else None)
        
    def load_directory(self):
        selected = filedialog.askdirectory(title="Select Folder containing sequential image sequences")
        if not selected:
            return
            
        self.source_dir = selected
        self.lbl_selected_dir.configure(text=self.source_dir)
        
        # Scan for standardized image extensions
        extensions = ('.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.webp')
        self.frames_list = sorted([
            os.path.join(self.source_dir, f) 
            for f in os.listdir(self.source_dir) 
            if f.lower().endswith(extensions)
        ])
        
        if not self.frames_list:
            messagebox.showerror("No Images Found", "The selected folder does not contain any compatible image formats.")
            return
            
        # Initialize Frame Timeline variables
        self.active_frames = [True] * len(self.frames_list)
        self.offsets = [(0, 0)] * len(self.frames_list)
        self.current_frame_index = 0
        
        self.status_var.set(f"Loaded {len(self.frames_list)} frames. Playback is running. Click and drag in alignment viewport to align drift.")
        
        # Enable Dashboard controls
        self.btn_prev.configure(state="normal")
        self.btn_play_pause.configure(state="normal")
        self.btn_next.configure(state="normal")
        self.btn_toggle_active.configure(state="normal")
        
        # Start execution loop
        self.is_playing = True
        self.btn_play_pause.configure(text="⏸ Pause")
        
        self.recompute()
        
    def recompute(self):
        """Main pipeline: resizes, quantizes, applies dithering and compiles the spritesheet."""
        if not self.frames_list:
            return
            
        if self.animation_job:
            self.root.after_cancel(self.animation_job)
            self.animation_job = None
            
        # Parse configuration tokens
        size_str = self.size_var.get()
        w_str, h_str = size_str.split("x")
        sprite_w, sprite_h = int(w_str), int(h_str)
        padding = self.pad_var.get()
        dither_type = self.dither_var.get()
        
        # 1. Sequential Image Downsampling (Nearest-Neighbor, preserving transparency)
        raw_resized_frames = []
        for i, file_path in enumerate(self.frames_list):
            try:
                img = Image.open(file_path).convert("RGBA")
                dx, dy = self.offsets[i]
                
                # Apply crop and manual offsets inside transparent canvas
                offset_canvas = Image.new("RGBA", img.size, color=(0, 0, 0, 0))
                offset_canvas.paste(img.crop((dx, dy, dx + img.width, dy + img.height)), (0, 0))
                
                # Convert using crisp non-bilinear scaling
                resized_img = offset_canvas.resize((sprite_w, sprite_h), Image.Resampling.NEAREST)
                raw_resized_frames.append(resized_img)
            except Exception as e:
                print(f"Failed to process frame {file_path}: {e}")
                # Fallback to empty transparent frame
                raw_resized_frames.append(Image.new("RGBA", (sprite_w, sprite_h), (0, 0, 0, 0)))
                
        # 2. Collect opaque pixels strictly from ACTIVE frames for representative clustering
        opaque_pixels = []
        for i, frame in enumerate(raw_resized_frames):
            if self.active_frames[i]:
                alpha_data = frame.split()[3].getdata()
                rgb_data = frame.convert("RGB").getdata()
                for idx, a_val in enumerate(alpha_data):
                    if a_val >= 128:  # Opaque threshold
                        opaque_pixels.append(rgb_data[idx])
                        
        if not opaque_pixels:
            # Fallback block if all frames are inactive or completely transparent
            opaque_pixels = [(0, 0, 0)]
            
        # 3. Median Cut Clustering down to 15 colors
        pixel_img = Image.new("RGB", (len(opaque_pixels), 1))
        pixel_img.putdata(opaque_pixels)
        global_quantized = pixel_img.quantize(colors=15, method=Image.Quantize.MEDIANCUT)
        raw_palette_bytes = global_quantized.getpalette()[:45] # 15 colors * 3 channels
        
        # 4. Clamp raw 24-bit RGB values to locked 15-bit SNES RGB palette space
        clamped_palette = []
        for val in raw_palette_bytes:
            five_bit_val = val // 8
            clamped_val = five_bit_val * 8
            clamped_palette.append(clamped_val)
            
        # Lock transparent index (15) to classic retro Magenta #FF00FF
        clamped_palette.extend([255, 0, 255])
        # Pad up to 256 colors for locked 8-bit compatibility
        while len(clamped_palette) < 768:
            clamped_palette.extend([0, 0, 0])
            
        self.master_palette = clamped_palette
        
        pal_template = Image.new("P", (1, 1))
        pal_template.putpalette(self.master_palette)
        
        # 5. Apply quantization and dithering rules
        self.processed_frames = []
        for i, raw_frame in enumerate(raw_resized_frames):
            rgb_part = raw_frame.convert("RGB")
            alpha_part = raw_frame.split()[3]
            
            if dither_type == "none":
                clamped_frame = rgb_part.quantize(palette=pal_template, dither=Image.Dither.NONE)
            elif dither_type == "floyd":
                clamped_frame = rgb_part.quantize(palette=pal_template, dither=Image.Dither.FLOYDSTEINBERG)
            elif dither_type == "bayer":
                clamped_frame = self.apply_bayer_dither(rgb_part, pal_template)
            else:
                clamped_frame = rgb_part.quantize(palette=pal_template, dither=Image.Dither.NONE)
                
            # Direct pixel inject to force transparent index (15) based on alpha mask
            pixels = bytearray(clamped_frame.tobytes())
            alpha_bytes = alpha_part.tobytes()
            for idx in range(len(pixels)):
                if alpha_bytes[idx] < 128:
                    pixels[idx] = 15
            clamped_frame.frombytes(bytes(pixels))
            
            self.processed_frames.append(clamped_frame)
            
        # 6. Build UI preview frame list (greying out disabled frames)
        self.preview_tk_images = []
        for i, img in enumerate(self.processed_frames):
            rgba_img = self.make_rgba_preview(img)
            if not self.active_frames[i]:
                # Blend disabled frames with dark gray overlay
                grey_overlay = Image.new("RGBA", rgba_img.size, (30, 30, 30, 190))
                rgba_img = Image.alpha_composite(rgba_img, grey_overlay)
            self.preview_tk_images.append(rgba_img)
            
        # 7. Assemble Sprite Sheet from active frames strictly
        active_processed_frames = [f for idx, f in enumerate(self.processed_frames) if self.active_frames[idx]]
        
        if not active_processed_frames:
            self.status_var.set("Active frame count is 0. Nothing to compile onto sheet.")
            self.sprite_sheet_img = None
            self.atlas_canvas.delete("all")
        else:
            num_frames = len(active_processed_frames)
            cols = math.ceil(math.sqrt(num_frames))
            rows = math.ceil(num_frames / cols)
            
            sheet_w = (sprite_w * cols) + (padding * (cols + 1))
            sheet_h = (sprite_h * rows) + (padding * (rows + 1))
            
            self.sprite_sheet_img = Image.new("P", (sheet_w, sheet_h), color=15)
            self.sprite_sheet_img.putpalette(self.master_palette)
            
            for index, frame in enumerate(active_processed_frames):
                c_col = index % cols
                c_row = index // cols
                x = (c_col * sprite_w) + (padding * (c_col + 1))
                y = (c_row * sprite_h) + (padding * (c_row + 1))
                self.sprite_sheet_img.paste(frame, (x, y))
                
            self.render_atlas_viewport()
            
        # Refresh Viewports
        if self.is_playing:
            self.setup_animation_loop()
        else:
            self.render_playback_viewport()
            
        # Enable action buttons
        if active_processed_frames:
            self.btn_compile.configure(state="normal")
            self.btn_export_gif.configure(state="normal")
            self.btn_export_html.configure(state="normal")
        else:
            self.btn_compile.configure(state="disabled")
            self.btn_export_gif.configure(state="disabled")
            self.btn_export_html.configure(state="disabled")
            
        gc.collect()
        
    def apply_bayer_dither(self, img_pil, pal_template):
        """Applies a classic 4x4 Bayer ordered dither matrix to an RGB image."""
        width, height = img_pil.size
        pixels = img_pil.load()
        
        # Standard Bayer 4x4 matrix scaled
        bayer_matrix = [
            [  0, 128,  32, 160],
            [192,  64, 224,  96],
            [ 48, 176,  16, 144],
            [240, 112, 208,  80]
        ]
        
        dithered_img = Image.new("RGB", (width, height))
        dithered_pix = dithered_img.load()
        
        for y in range(height):
            for x in range(width):
                factor = (bayer_matrix[y % 4][x % 4] / 255.0) - 0.5
                r, g, b = pixels[x, y]
                offset = int(factor * 48)  # Halftone mesh intensity constant
                dithered_pix[x, y] = (
                    max(0, min(255, r + offset)),
                    max(0, min(255, g + offset)),
                    max(0, min(255, b + offset))
                )
                
        return dithered_img.quantize(palette=pal_template, dither=Image.Dither.NONE)
        
    def compose_preview_image(self, sprite_rgba, canvas_w, canvas_h, margin_factor=0.95):
        """High performance method: composes tiled checkerboard and scaled sprite onto one PIL buffer."""
        tile_size = 14
        tile = Image.new("RGB", (tile_size * 2, tile_size * 2), color=self.checker_dark1)
        draw = ImageDraw.Draw(tile)
        draw.rectangle([tile_size, 0, tile_size * 2, tile_size], fill=self.checker_dark2)
        draw.rectangle([0, tile_size, tile_size, tile_size * 2], fill=self.checker_dark2)
        
        # Fast tile paste
        checker_img = Image.new("RGB", (canvas_w, canvas_h))
        for y in range(0, canvas_h, tile_size * 2):
            for x in range(0, canvas_w, tile_size * 2):
                checker_img.paste(tile, (x, y))
                
        # Scale sprite cell
        img_w, img_h = sprite_rgba.size
        scale = min(canvas_w / img_w, canvas_h / img_h) * margin_factor
        scale = max(1.0, scale)
        scaled_w, scaled_h = int(img_w * scale), int(img_h * scale)
        
        scaled_sprite = sprite_rgba.resize((scaled_w, scaled_h), Image.Resampling.NEAREST)
        
        # Center composite paste
        px = (canvas_w - scaled_w) // 2
        py = (canvas_h - scaled_h) // 2
        checker_img.paste(scaled_sprite, (px, py), mask=scaled_sprite)
        
        return checker_img
        
    def render_atlas_viewport(self):
        if not self.sprite_sheet_img:
            return
            
        try:
            self.atlas_canvas.delete("all")
            canvas_w = self.atlas_canvas.winfo_width()
            canvas_h = self.atlas_canvas.winfo_height()
        except tk.TclError:
            return  # Widget destroyed during window exit
            
        if canvas_w < 10 or canvas_h < 10:
            try:
                self.root.after(100, self.render_atlas_viewport)
            except tk.TclError:
                pass
            return
            
        # Draw pre-composited image buffer on screen
        preview_rgba = self.make_rgba_preview(self.sprite_sheet_img)
        composed_img = self.compose_preview_image(preview_rgba, canvas_w, canvas_h, margin_factor=0.95)
        
        self.atlas_photo = ImageTk.PhotoImage(composed_img)
        self.atlas_canvas.create_image(0, 0, image=self.atlas_photo, anchor="nw")
        
    def setup_animation_loop(self):
        if self.current_frame_index >= len(self.preview_tk_images):
            self.current_frame_index = 0
        self.loop_animation()
        
    def loop_animation(self):
        if not self.preview_tk_images:
            return
            
        if self.animation_job:
            self.root.after_cancel(self.animation_job)
            self.animation_job = None
            
        if not self.is_playing:
            return
            
        self.render_playback_viewport()
        
        # Advance index to the next active frame in cycle
        num_frames = len(self.preview_tk_images)
        next_idx = (self.current_frame_index + 1) % num_frames
        
        # Find next enabled frame
        search_count = 0
        while not self.active_frames[next_idx] and search_count < num_frames:
            next_idx = (next_idx + 1) % num_frames
            search_count += 1
            
        self.current_frame_index = next_idx
        
        fps = self.fps_var.get()
        delay_ms = int(1000 / fps)
        try:
            self.animation_job = self.root.after(delay_ms, self.loop_animation)
        except tk.TclError:
            pass
        
    def render_playback_viewport(self):
        if not self.preview_tk_images:
            return
            
        try:
            self.preview_canvas.delete("all")
            canvas_w = self.preview_canvas.winfo_width()
            canvas_h = self.preview_canvas.winfo_height()
        except tk.TclError:
            return  # Widget destroyed during window exit
            
        if canvas_w < 10 or canvas_h < 10:
            return
            
        current_frame = self.preview_tk_images[self.current_frame_index]
        composed_img = self.compose_preview_image(current_frame, canvas_w, canvas_h, margin_factor=0.75)
        
        self.preview_photo = ImageTk.PhotoImage(composed_img)
        self.preview_canvas.create_image(0, 0, image=self.preview_photo, anchor="nw")
        
        # Draw registration crosshair
        cx, cy = canvas_w // 2, canvas_h // 2
        self.preview_canvas.create_line(cx - 20, cy, cx + 20, cy, fill="#FF453A", width=1)
        self.preview_canvas.create_line(cx, cy - 20, cx, cy + 20, fill="#FF453A", width=1)
        
        # Update Timeline Info Labels
        dx, dy = self.offsets[self.current_frame_index]
        is_active = self.active_frames[self.current_frame_index]
        state_str = "ACTIVE" if is_active else "INACTIVE (Skipped)"
        
        self.frame_info_var.set(
            f"Display Frame {self.current_frame_index + 1}/{len(self.preview_tk_images)} | State: {state_str} | "
            f"Pivot Offset -> dx: {dx:+}px, dy: {dy:+}px (Drag anywhere in viewport to align)"
        )
        
    def pause_playback(self):
        self.is_playing = False
        if self.animation_job:
            self.root.after_cancel(self.animation_job)
            self.animation_job = None
        self.btn_play_pause.configure(text="▶ Play")
        self.render_playback_viewport()
        
    def play_playback(self):
        self.is_playing = True
        self.btn_play_pause.configure(text="⏸ Pause")
        self.loop_animation()
        
    def toggle_play_pause(self):
        if self.is_playing:
            self.pause_playback()
        else:
            self.play_playback()
            
    def step_next_frame(self):
        if not self.preview_tk_images:
            return
        self.pause_playback()
        
        num_frames = len(self.preview_tk_images)
        next_idx = (self.current_frame_index + 1) % num_frames
        
        # Find next enabled frame
        search_count = 0
        while not self.active_frames[next_idx] and search_count < num_frames:
            next_idx = (next_idx + 1) % num_frames
            search_count += 1
            
        self.current_frame_index = next_idx
        self.render_playback_viewport()
        
    def step_prev_frame(self):
        if not self.preview_tk_images:
            return
        self.pause_playback()
        
        num_frames = len(self.preview_tk_images)
        prev_idx = (self.current_frame_index - 1) % num_frames
        
        # Find previous enabled frame
        search_count = 0
        while not self.active_frames[prev_idx] and search_count < num_frames:
            prev_idx = (prev_idx - 1) % num_frames
            search_count += 1
            
        self.current_frame_index = prev_idx
        self.render_playback_viewport()
        
    def toggle_frame_active(self):
        if not self.preview_tk_images:
            return
        self.active_frames[self.current_frame_index] = not self.active_frames[self.current_frame_index]
        self.recompute()
        
    def start_registration_drag(self, event):
        """Initializes dragging to offset pivot coordinates."""
        if not self.preview_tk_images:
            return
        # Freeze frame index to edit currently active sprite slice
        self.pause_playback()
        self.drag_start_x = event.x
        self.drag_start_y = event.y
        
    def execute_registration_drag(self, event):
        """Calculates displacement factors and updates frame alignment offsets."""
        if not self.preview_tk_images:
            return
            
        dx = event.x - self.drag_start_x
        dy = event.y - self.drag_start_y
        
        # Drag sensitivity alignment threshold
        if abs(dx) > 3 or abs(dy) > 3:
            curr_dx, curr_dy = self.offsets[self.current_frame_index]
            # Accumulate drag offsets to shift crop alignment bounds
            self.offsets[self.current_frame_index] = (curr_dx + int(dx // 4), curr_dy + int(dy // 4))
            
            self.drag_start_x = event.x
            self.drag_start_y = event.y
            
            # Instantly recompute and redraw frames
            self.recompute()
            
    def make_rgba_preview(self, pil_img):
        """Creates transparent RGBA views for standard displays by mapping #FF00FF to transparent."""
        rgba = pil_img.convert("RGBA")
        raw_pixels = list(rgba.getdata())
        cleaned_data = [
            (0, 0, 0, 0) if pixel[0] == 255 and pixel[1] == 0 and pixel[2] == 255 else pixel
            for pixel in raw_pixels
        ]
        rgba.putdata(cleaned_data)
        return rgba
        
    def on_fps_change(self, val):
        if self.preview_tk_images and self.is_playing:
            self.loop_animation()
            
    def export_png(self):
        if not self.sprite_sheet_img:
            return
        dest = filedialog.asksaveasfilename(defaultextension=".png", filetypes=[("PNG Image", "*.png")], title="Export Indexed Retro Sprite Sheet")
        if dest:
            self.sprite_sheet_img.save(dest)
            self.status_var.set(f"Export Success: Sheet saved to {os.path.basename(dest)}")
            messagebox.showinfo("Export Successful", f"Indexed sprite sheet compiled successfully and saved to {os.path.basename(dest)}")
            
    def export_gif(self):
        active_processed_frames = [f for idx, f in enumerate(self.processed_frames) if self.active_frames[idx]]
        if not active_processed_frames:
            return
        dest = filedialog.asksaveasfilename(defaultextension=".gif", filetypes=[("GIF Animation", "*.gif")], title="Export Diagnostic Loop Preview")
        if dest:
            fps = self.fps_var.get()
            delay_ms = int(1000 / fps)
            active_processed_frames[0].save(
                dest,
                save_all=True,
                append_images=active_processed_frames[1:],
                duration=delay_ms,
                loop=0,
                transparency=15
            )
            self.status_var.set(f"Export Success: Diagnostic Preview GIF saved to {os.path.basename(dest)}")
            messagebox.showinfo("Export Successful", f"Diagnostic looping GIF generated successfully and saved to {os.path.basename(dest)}")
            
    def export_html5(self):
        """Generates a complete HTML5 Local Playtest Sandbox with a working canvas frame engine."""
        if not self.sprite_sheet_img:
            return
            
        dest_dir = filedialog.askdirectory(title="Select Target Folder for HTML5 Playtest Sandbox")
        if not dest_dir:
            return
            
        # Save sprite sheet alongside sandbox
        sprite_sheet_path = os.path.join(dest_dir, "spritesheet.png")
        self.sprite_sheet_img.save(sprite_sheet_path)
        
        # Determine sizes
        size_str = self.size_var.get()
        w_str, h_str = size_str.split("x")
        sprite_w, sprite_h = int(w_str), int(h_str)
        padding = self.pad_var.get()
        
        active_processed_frames = [f for idx, f in enumerate(self.processed_frames) if self.active_frames[idx]]
        num_frames = len(active_processed_frames)
        cols = math.ceil(math.sqrt(num_frames))
        
        # Construct active coordinates list
        frame_coordinates = []
        for index in range(num_frames):
            col = index % cols
            row = index // cols
            x = (col * sprite_w) + (padding * (col + 1))
            y = (row * sprite_h) + (padding * (row + 1))
            frame_coordinates.append({"x": x, "y": y})
            
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dex Sprite HTML5 Playtest Sandbox</title>
    <style>
        body {{
            background-color: #0A0A0C;
            color: #ffffff;
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
        }}
        h1 {{
            font-size: 26px;
            font-weight: 800;
            margin-bottom: 5px;
            letter-spacing: -0.8px;
            background: linear-gradient(135deg, #007AFF, #30D158);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        .subtitle {{
            color: #8E8E93;
            font-size: 14px;
            margin-bottom: 30px;
        }}
        .container {{
            background: #1C1C1E;
            padding: 35px;
            border-radius: 20px;
            box-shadow: 0 15px 45px rgba(0,0,0,0.6);
            display: flex;
            flex-direction: column;
            align-items: center;
            border: 1px solid #2C2C2E;
        }}
        canvas {{
            background-image: linear-gradient(45deg, #151517 25%, transparent 25%), 
                              linear-gradient(-45deg, #151517 25%, transparent 25%), 
                              linear-gradient(45deg, transparent 75%, #151517 75%), 
                              linear-gradient(-45deg, transparent 75%, #151517 75%);
            background-size: 20px 20px;
            background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
            background-color: #1A1A1E;
            border-radius: 12px;
            margin-bottom: 25px;
            image-rendering: pixelated;
            border: 1px solid #3A3A3C;
        }}
        .controls {{
            display: flex;
            gap: 25px;
            align-items: center;
            width: 100%;
            justify-content: center;
        }}
        .btn {{
            background-color: #007AFF;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
        }}
        .btn:hover {{
            background-color: #359AFF;
            transform: translateY(-1px);
        }}
        .btn:active {{
            transform: translateY(0);
        }}
        .slider-group {{
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            min-width: 180px;
        }}
        label {{
            font-size: 11px;
            color: #8E8E93;
            margin-bottom: 6px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        input[type="range"] {{
            width: 100%;
            cursor: pointer;
            accent-color: #007AFF;
        }}
    </style>
</head>
<body>

    <h1>DEX SPRITE PLAYTEST SANDBOX</h1>
    <div class="subtitle">Direct HTML5 Canvas Frame Execution Engine</div>

    <div class="container">
        <canvas id="gameCanvas" width="{sprite_w * 8}" height="{sprite_h * 8}"></canvas>
        <div class="controls">
            <button class="btn" id="playBtn">Pause</button>
            <div class="slider-group">
                <label id="fpsLabel">SPEED: {self.fps_var.get()} FPS</label>
                <input type="range" id="fpsRange" min="1" max="30" value="{self.fps_var.get()}">
            </div>
        </div>
    </div>

    <script>
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false; // Direct pixel boundaries

        const spriteSheet = new Image();
        spriteSheet.src = 'spritesheet.png';

        const frames = {json.dumps(frame_coordinates)};
        const spriteW = {sprite_w};
        const spriteH = {sprite_h};
        
        let currentFrameIndex = 0;
        let isPlaying = true;
        let fps = {self.fps_var.get()};
        let lastFrameTime = 0;

        spriteSheet.onload = () => {{
            requestAnimationFrame(gameLoop);
        }};

        function gameLoop(time) {{
            if (!isPlaying) {{
                requestAnimationFrame(gameLoop);
                return;
            }}

            const delta = time - lastFrameTime;
            const interval = 1000 / fps;

            if (delta >= interval) {{
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                const frame = frames[currentFrameIndex];
                
                // Draw sprite scaled sharply
                ctx.drawImage(
                    spriteSheet,
                    frame.x, frame.y, spriteW, spriteH, // Source sprite cell bounds
                    0, 0, canvas.width, canvas.height // Canvas viewport upscale
                );
                
                currentFrameIndex = (currentFrameIndex + 1) % frames.length;
                lastFrameTime = time - (delta % interval);
            }}
            
            requestAnimationFrame(gameLoop);
        }}

        // Interface controls bindings
        const playBtn = document.getElementById('playBtn');
        playBtn.addEventListener('click', () => {{
            isPlaying = !isPlaying;
            playBtn.textContent = isPlaying ? 'Pause' : 'Play';
        }});

        const fpsRange = document.getElementById('fpsRange');
        const fpsLabel = document.getElementById('fpsLabel');
        fpsRange.addEventListener('input', (e) => {{
            fps = parseInt(e.target.value);
            fpsLabel.textContent = `SPEED: ${{fps}} FPS`;
        }});
    </script>
</body>
</html>
"""
        with open(os.path.join(dest_dir, "index.html"), "w") as html_file:
            html_file.write(html_content)
            
        self.status_var.set(f"Sandbox Compiled: Saved 'index.html' and 'spritesheet.png' to target directory!")
        messagebox.showinfo("HTML5 Export Complete", "The local HTML5 browser playtest playground and compiled spritesheet have been generated successfully!")

if __name__ == "__main__":
    root = tk.Tk()
    app = DexSpriteApp(root)
    
    # Scale canvas dynamically on window configuration resizes
    root.bind("<Configure>", lambda e: app.render_atlas_viewport() if app.sprite_sheet_img else None)
    root.mainloop()
