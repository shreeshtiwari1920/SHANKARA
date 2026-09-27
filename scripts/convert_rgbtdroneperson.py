import json
import shutil
from pathlib import Path


RAW_DIR = Path("datasets/raw/RGBTDronePerson")
OUTPUT_DIR = Path("datasets/processed/RGBTDronePerson")


# COCO category ID -> YOLO class ID
CATEGORY_MAP = {
    0: 0,  # person
    1: 1,  # rider
    2: 2,  # crowd
}


SPLITS = {
    "train": {
        "visible": RAW_DIR / "train/visible",
        "thermal": RAW_DIR / "train/thermal",
        "json": RAW_DIR / "train_thermal.json",
    },
    "val": {
        "visible": RAW_DIR / "val/visible",
        "thermal": RAW_DIR / "val/thermal",
        "json": RAW_DIR / "val_thermal.json",
    },
}


def convert_bbox(bbox, width, height):
    """
    Convert COCO bounding box:

        [x, y, width, height]

    to YOLO format:

        [x_center, y_center, width, height]

    All values are normalized to 0-1.
    """

    x, y, w, h = bbox

    x_center = (x + w / 2) / width
    y_center = (y + h / 2) / height

    w = w / width
    h = h / height

    return x_center, y_center, w, h


def process_split(split_name, paths):
    print(f"\nProcessing {split_name}...")

    with open(paths["json"], "r") as f:
        data = json.load(f)

    images = data["images"]
    annotations = data["annotations"]

    # Map image ID -> image information
    image_map = {
        image["id"]: image
        for image in images
    }

    # Group relevant annotations by image
    annotations_by_image = {}

    for annotation in annotations:

        category_id = annotation["category_id"]

        # Ignore "uncertain"
        if category_id not in CATEGORY_MAP:
            continue

        image_id = annotation["image_id"]

        annotations_by_image.setdefault(image_id, []).append(annotation)

    output_visible = OUTPUT_DIR / split_name / "visible"
    output_thermal = OUTPUT_DIR / split_name / "thermal"
    output_labels = OUTPUT_DIR / split_name / "labels"

    output_visible.mkdir(parents=True, exist_ok=True)
    output_thermal.mkdir(parents=True, exist_ok=True)
    output_labels.mkdir(parents=True, exist_ok=True)

    processed = 0
    missing = 0

    for image in images:

        image_id = image["id"]
        filename = image["file_name"]

        visible_file = paths["visible"] / filename
        thermal_file = paths["thermal"] / filename

        if not visible_file.exists() or not thermal_file.exists():
            print(f"Warning: missing image pair: {filename}")
            missing += 1
            continue

        label_file = output_labels / f"{Path(filename).stem}.txt"

        with open(label_file, "w") as f:

            for annotation in annotations_by_image.get(image_id, []):

                bbox = annotation["bbox"]

                x_center, y_center, width, height = convert_bbox(
                    bbox,
                    image["width"],
                    image["height"],
                )

                yolo_class = CATEGORY_MAP[
                    annotation["category_id"]
                ]

                f.write(
                    f"{yolo_class} "
                    f"{x_center:.6f} "
                    f"{y_center:.6f} "
                    f"{width:.6f} "
                    f"{height:.6f}\n"
                )

        # Copy paired visible and thermal images
        shutil.copy2(
            visible_file,
            output_visible / filename
        )

        shutil.copy2(
            thermal_file,
            output_thermal / filename
        )

        processed += 1

        if processed % 500 == 0:
            print(f"Processed {processed}/{len(images)}")

    print(f"Finished {split_name}")
    print(f"Images processed: {processed}")
    print(f"Missing pairs: {missing}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for split_name, paths in SPLITS.items():
        process_split(split_name, paths)

    print("\nRGBTDronePerson preprocessing complete.")


if __name__ == "__main__":
    main()