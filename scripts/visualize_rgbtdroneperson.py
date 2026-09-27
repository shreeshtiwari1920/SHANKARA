from pathlib import Path

import cv2


ROOT = Path("datasets/processed/RGBTDronePerson")

SPLIT = "train"
IMAGE_NAME = "00000.jpg"

VISIBLE_IMAGE = ROOT / SPLIT / "visible" / IMAGE_NAME
THERMAL_IMAGE = ROOT / SPLIT / "thermal" / IMAGE_NAME
LABEL_FILE = ROOT / SPLIT / "labels" / "00000.txt"

OUTPUT_DIR = Path("runs/rgbtdroneperson_proof")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


CLASS_NAMES = {
    0: "person",
    1: "rider",
    2: "crowd",
}


def draw_boxes(image):
    height, width = image.shape[:2]

    with open(LABEL_FILE, "r") as f:
        for line in f:
            values = line.strip().split()

            if len(values) != 5:
                continue

            class_id = int(values[0])
            x_center = float(values[1]) * width
            y_center = float(values[2]) * height
            box_width = float(values[3]) * width
            box_height = float(values[4]) * height

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

            label = CLASS_NAMES.get(class_id, "unknown")

            cv2.putText(
                image,
                label,
                (x1, max(y1 - 8, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2,
            )

    return image


def main():

    visible = cv2.imread(str(VISIBLE_IMAGE))
    thermal = cv2.imread(str(THERMAL_IMAGE))

    if visible is None:
        raise FileNotFoundError(VISIBLE_IMAGE)

    if thermal is None:
        raise FileNotFoundError(THERMAL_IMAGE)

    visible = draw_boxes(visible)
    thermal = draw_boxes(thermal)

    cv2.imwrite(
        str(OUTPUT_DIR / "00000_visible.png"),
        visible,
    )

    cv2.imwrite(
        str(OUTPUT_DIR / "00000_thermal.png"),
        thermal,
    )

    print("Saved:")
    print(OUTPUT_DIR / "00000_visible.png")
    print(OUTPUT_DIR / "00000_thermal.png")


if __name__ == "__main__":
    main()