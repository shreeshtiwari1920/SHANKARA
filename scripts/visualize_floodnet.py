from pathlib import Path

import numpy as np
from PIL import Image

IMAGE = Path("datasets/raw/FloodNet/train/img/8962.jpg")
MASK = Path("datasets/processed/FloodNet/train/masks/8962.jpg.png")
OUTPUT = Path("runs/floodnet_proof/8962_overlay.png")

image = Image.open(IMAGE).convert("RGB")
mask = np.array(Image.open(MASK))

# Create a simple color visualization for the classes.
colors = {
    0: (0, 0, 0),
    1: (255, 0, 0),
    2: (255, 100, 100),
    3: (0, 0, 255),
    4: (100, 100, 255),
    5: (0, 255, 255),
    6: (0, 255, 0),
    7: (255, 255, 0),
    8: (255, 0, 255),
    9: (150, 100, 50),
}

mask_rgb = np.zeros((*mask.shape, 3), dtype=np.uint8)

for class_id, color in colors.items():
    mask_rgb[mask == class_id] = color

mask_image = Image.fromarray(mask_rgb)

# Blend original image and segmentation mask.
overlay = Image.blend(image, mask_image, alpha=0.45)

overlay.save(OUTPUT)

print("Saved:", OUTPUT)