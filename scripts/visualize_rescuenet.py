from pathlib import Path

import numpy as np
from PIL import Image


IMAGE_PATH = Path(
    "datasets/processed/RescueNet/test/images/12250.jpg"
)

MASK_PATH = Path(
    "datasets/processed/RescueNet/test/masks/12250_lab.png"
)

OUTPUT_PATH = Path(
    "runs/rescuenet_proof/12250_overlay.png"
)


# Simple colors for visualization.
COLORS = np.array([
    [0, 0, 0],        # 0 Background
    [0, 255, 255],    # 1 Water
    [0, 255, 0],      # 2 Building - No Damage
    [255, 255, 0],    # 3 Building - Minor Damage
    [255, 165, 0],    # 4 Building - Major Damage
    [255, 0, 0],      # 5 Building - Total Destruction
    [0, 128, 255],    # 6 Road - Clear
    [255, 0, 255],    # 7 Road - Blocked
    [255, 255, 255],  # 8 Vehicle
    [0, 128, 0],      # 9 Tree
    [128, 0, 128],    # 10 Pool
], dtype=np.uint8)


def main():
    image = np.array(Image.open(IMAGE_PATH).convert("RGB"))
    mask = np.array(Image.open(MASK_PATH))

    colored_mask = COLORS[mask]

    # Blend original image with segmentation mask.
    overlay = (
        0.6 * image +
        0.4 * colored_mask
    ).astype(np.uint8)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    Image.fromarray(overlay).save(OUTPUT_PATH)

    print(f"Saved overlay to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()