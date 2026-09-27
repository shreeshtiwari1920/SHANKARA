from pathlib import Path
import shutil

from PIL import Image
import numpy as np


RAW_DIR = Path("datasets/raw/RescueNet")
OUTPUT_DIR = Path("datasets/processed/RescueNet")


SPLITS = {
    "test": {
        "images": RAW_DIR / "segmentation-testset/test-org-img",
        "masks": RAW_DIR / "segmentation-testset/test-label-img",
    },
    "validation": {
        "images": RAW_DIR / "segmentation-validationset/val-org-img",
        "masks": RAW_DIR / "segmentation-validationset/val-label-img",
    },
}


CLASS_NAMES = {
    0: "background",
    1: "water",
    2: "building_no_damage",
    3: "building_minor_damage",
    4: "building_major_damage",
    5: "building_total_destruction",
    6: "road_clear",
    7: "road_blocked",
    8: "vehicle",
    9: "tree",
    10: "pool",
}


def process_split(split_name, paths):
    """Process one RescueNet split."""

    image_dir = paths["images"]
    mask_dir = paths["masks"]

    output_images = OUTPUT_DIR / split_name / "images"
    output_masks = OUTPUT_DIR / split_name / "masks"

    output_images.mkdir(parents=True, exist_ok=True)
    output_masks.mkdir(parents=True, exist_ok=True)

    image_files = sorted(image_dir.glob("*.jpg"))

    print(f"\nProcessing {split_name}: {len(image_files)} images")

    processed = 0
    skipped = 0

    for image_file in image_files:
        image_id = image_file.stem
        mask_file = mask_dir / f"{image_id}_lab.png"

        if not mask_file.exists():
            print(f"Warning: mask not found for {image_file.name}")
            skipped += 1
            continue

        image = Image.open(image_file)
        mask = Image.open(mask_file)

        if image.size != mask.size:
            print(
                f"Warning: size mismatch for {image_id}: "
                f"image={image.size}, mask={mask.size}"
            )
            skipped += 1
            continue

        mask_array = np.array(mask)

        unique_values = set(np.unique(mask_array).tolist())

        invalid_values = unique_values - set(CLASS_NAMES.keys())

        if invalid_values:
            print(
                f"Warning: invalid class values in {mask_file.name}: "
                f"{sorted(invalid_values)}"
            )
            skipped += 1
            continue

        output_image = output_images / image_file.name
        output_mask = output_masks / mask_file.name

        shutil.copy2(image_file, output_image)
        shutil.copy2(mask_file, output_mask)

        processed += 1

        if processed % 50 == 0:
            print(f"Processed {processed}/{len(image_files)}")

    print(f"Finished {split_name}")
    print(f"Processed: {processed}")
    print(f"Skipped: {skipped}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for split_name, paths in SPLITS.items():
        process_split(split_name, paths)

    print("\nRescueNet preprocessing complete.")


if __name__ == "__main__":
    main()