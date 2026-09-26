import base64
import io
import json
import zlib
from pathlib import Path

import numpy as np
from PIL import Image


RAW_DIR = Path("datasets/raw/FloodNet")
OUTPUT_DIR = Path("datasets/processed/FloodNet")

SPLITS = ["train", "validation", "test"]


CLASS_MAP = {
    "background": 0,
    "building flooded": 1,
    "building non-flooded": 2,
    "road flooded": 3,
    "road non-flooded": 4,
    "water": 5,
    "tree": 6,
    "vehicle": 7,
    "pool": 8,
    "grass": 9,
}


def decode_bitmap(bitmap_data):
    """Decode Supervisely bitmap data into a PIL image."""

    compressed = base64.b64decode(bitmap_data)
    png_data = zlib.decompress(compressed)

    return Image.open(io.BytesIO(png_data)).convert("L")


def create_mask(annotation):
    """Create one full-size semantic segmentation mask."""

    width = annotation["size"]["width"]
    height = annotation["size"]["height"]

    mask = np.zeros((height, width), dtype=np.uint8)

    for obj in annotation["objects"]:
        class_name = obj["classTitle"]

        if class_name not in CLASS_MAP:
            print(f"Warning: unknown class '{class_name}'")
            continue

        class_id = CLASS_MAP[class_name]

        bitmap = obj["bitmap"]
        origin_x, origin_y = bitmap["origin"]

        cropped_mask = decode_bitmap(bitmap["data"])
        cropped_mask = np.array(cropped_mask)

        mask_height, mask_width = cropped_mask.shape

        # Supervisely bitmap masks use non-zero pixels
        # to indicate the annotated region.
        region = cropped_mask > 0

        y_end = min(origin_y + mask_height, height)
        x_end = min(origin_x + mask_width, width)

        valid_height = y_end - origin_y
        valid_width = x_end - origin_x

        if valid_height <= 0 or valid_width <= 0:
            continue

        mask_region = mask[
            origin_y:y_end,
            origin_x:x_end
        ]

        mask_region[region[:valid_height, :valid_width]] = class_id

    return mask


def process_split(split):
    ann_dir = RAW_DIR / split / "ann"
    output_dir = OUTPUT_DIR / split / "masks"

    output_dir.mkdir(parents=True, exist_ok=True)

    annotation_files = sorted(ann_dir.glob("*.json"))

    print(f"\nProcessing {split}: {len(annotation_files)} annotations")

    for i, ann_file in enumerate(annotation_files, start=1):

        with open(ann_file, "r") as f:
            annotation = json.load(f)

        mask = create_mask(annotation)

        output_name = ann_file.stem + ".png"
        output_file = output_dir / output_name

        Image.fromarray(mask).save(output_file)

        print(f"[{i}/{len(annotation_files)}] {output_name}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for split in SPLITS:
        process_split(split)

    print("\nFloodNet preprocessing complete.")


if __name__ == "__main__":
    main()