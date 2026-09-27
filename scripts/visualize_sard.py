from pathlib import Path

import cv2


DATASET_DIR = Path("datasets/processed/SARD")
OUTPUT_DIR = Path("runs/sard_proof")

SPLIT = "test"

CLASS_NAMES = {
    0: "human",
}


def draw_boxes(image, label_file):
    """Draw YOLO bounding boxes on an image."""

    height, width = image.shape[:2]

    if not label_file.exists():
        return image

    with open(label_file, "r") as f:
        lines = f.read().strip().splitlines()

    for line in lines:
        parts = line.split()

        if len(parts) != 5:
            continue

        class_id = int(parts[0])
        x_center, y_center, box_width, box_height = map(
            float, parts[1:]
        )

        # Convert normalized YOLO coordinates to pixels
        x_center *= width
        y_center *= height
        box_width *= width
        box_height *= height

        x1 = int(x_center - box_width / 2)
        y1 = int(y_center - box_height / 2)
        x2 = int(x_center + box_width / 2)
        y2 = int(y_center + box_height / 2)

        cv2.rectangle(
            image,
            (x1, y1),
            (x2, y2),
            (0, 255, 0),
            2,
        )

        label = CLASS_NAMES.get(class_id, str(class_id))

        cv2.putText(
            image,
            label,
            (x1, max(y1 - 8, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2,
        )

    return image


def main():
    image_dir = DATASET_DIR / SPLIT / "images"
    label_dir = DATASET_DIR / SPLIT / "labels"

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    image_files = sorted(image_dir.glob("*.jpg"))

    if not image_files:
        print("No images found.")
        return

    # Pick the first test image
    image_file = image_files[0]
    label_file = label_dir / f"{image_file.stem}.txt"

    image = cv2.imread(str(image_file))

    if image is None:
        print(f"Could not read image: {image_file}")
        return

    image = draw_boxes(image, label_file)

    output_file = OUTPUT_DIR / f"{image_file.stem}_overlay.jpg"

    cv2.imwrite(str(output_file), image)

    print(f"Image: {image_file}")
    print(f"Labels: {label_file}")
    print(f"Output: {output_file}")


if __name__ == "__main__":
    main()