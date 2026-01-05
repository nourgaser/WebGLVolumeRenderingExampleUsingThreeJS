import os
import pydicom
import numpy as np
from PIL import Image
import math

# --- Configuration ---
INPUT_FOLDER = './input'  # Folder containing your .dcm files
OUTPUT_FILE = 'output.png'
ATLAS_SIZE = 4096
GRID_SIZE = 16  # 16x16
SLICE_RES = ATLAS_SIZE // GRID_SIZE  # 256 pixels
TARGET_SLICES = GRID_SIZE * GRID_SIZE # 256 slices

def load_scan(path):
    slices = [pydicom.dcmread(os.path.join(path, s)) for s in os.listdir(path) if s.endswith('.dcm')]
    # Sort by ImagePositionPatient Z coordinate
    slices.sort(key=lambda x: float(x.ImagePositionPatient[2]))
    return slices

def get_pixels_hu(slices):
    image = np.stack([s.pixel_array for s in slices])
    image = image.astype(np.int16)

    # Try to read RescaleIntercept/Slope, default to 0/1 if missing (e.g. for MRI)
    intercept = getattr(slices[0], 'RescaleIntercept', 0)
    slope = getattr(slices[0], 'RescaleSlope', 1)
    
    if slope != 1:
        image = slope * image.astype(np.float64)
        image = image.astype(np.int16)
        
    image += np.int16(intercept)
    return np.array(image, dtype=np.int16)

def resize_volume(volume, target_depth, target_res):
    current_depth, current_h, current_w = volume.shape
    
    # --- MEDICAL WINDOWING SETTINGS ---
    # We force the range to standard medical values.
    # Air is -1000. Anything below -900 should be invisible.
    # Bone is +1000. Soft tissue is +40 to +100.
    
    # Setting the floor to -900 ensures air (-1000) becomes 0 (Transparent).
    MIN_BOUND = -900  
    MAX_BOUND = 1500  
    
    print(f"Applying Windowing: Clipping values < {MIN_BOUND} to 0 (Transparent)")

    resized_slices = []
    
    # Calculate step size for Z-axis
    z_indices = np.linspace(0, current_depth - 1, target_depth)
    
    for z in z_indices:
        slice_idx = int(round(z))
        slice_data = volume[slice_idx]
        
        # 1. Clip the data to our window
        # Any pixel less than -900 becomes -900.
        # Any pixel more than 1500 becomes 1500.
        slice_data = np.clip(slice_data, MIN_BOUND, MAX_BOUND)
        
        # 2. Normalize: Map [MIN_BOUND, MAX_BOUND] to [0, 255]
        # (val - min) / (max - min)
        slice_data = ((slice_data - MIN_BOUND) / (MAX_BOUND - MIN_BOUND)) * 255.0
        
        slice_data = slice_data.astype(np.uint8)
        
        img = Image.fromarray(slice_data)
        img = img.resize((target_res, target_res), Image.Resampling.BILINEAR)
        resized_slices.append(np.array(img))
        
    return np.stack(resized_slices)

def create_atlas(volume_data):
    # Create valid RGBA image (Standard gl_FragColor logic)
    # We will put the density in ALL channels (R,G,B) + Alpha
    # The shader specifically asks for Alpha, but having it in RGB helps debugging
    
    atlas = Image.new('RGBA', (ATLAS_SIZE, ATLAS_SIZE), (0, 0, 0, 0))
    
    for i, slice_data in enumerate(volume_data):
        # Determine Grid Position
        # Shader: Top-Left is Z=0, Bottom-Right is Z=255
        
        # Row 0 is the top row in PIL logic
        row = i // GRID_SIZE
        col = i % GRID_SIZE
        
        x_pos = col * SLICE_RES
        y_pos = row * SLICE_RES
        
        # Create an image where opacity = pixel value
        # Grayscale image
        img_gray = Image.fromarray(slice_data, mode='L')
        
        # Create RGBA: White color, but Alpha varies with density
        # Or: Grayscale color, Alpha varies with density.
        # Let's map the slice data to the Alpha channel.
        r = img_gray
        g = img_gray
        b = img_gray
        a = img_gray # Use density as transparency
        
        slice_rgba = Image.merge("RGBA", (r, g, b, a))
        
        atlas.paste(slice_rgba, (x_pos, y_pos))
        
    return atlas

print("Loading DICOM...")
slices = load_scan(INPUT_FOLDER)
print(f"Loaded {len(slices)} slices.")

print("Processing Volume (this may take a moment)...")
vol_hu = get_pixels_hu(slices)
vol_resized = resize_volume(vol_hu, TARGET_SLICES, SLICE_RES)

print("Packing Atlas...")
atlas_img = create_atlas(vol_resized)

print(f"Saving to {OUTPUT_FILE}...")
atlas_img.save(OUTPUT_FILE)
print("Done!")