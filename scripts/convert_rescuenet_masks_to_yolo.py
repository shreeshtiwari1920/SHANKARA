from pathlib import Path
import cv2
import numpy as np

ROOT = Path("datasets/processed/RescueNetSeg")

for split in ["train", "val"]:
    image_dir = ROOT / split / "images"
    mask_dir = ROOT / split / "masks"
    label_dir = ROOT / split / "labels"
    label_dir.mkdir(parents=True, exist_ok=True)

    count = 0

    for mask_path in sorted(mask_dir.glob("*_lab.png")):
        mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)

        if mask is None:
            continue

        h, w = mask.shape
        lines = []

        # 0 = background, so start at class 1
        for cls in range(1, 11):
            binary = (mask == cls).astype(np.uint8) * 255

            contours, _ = cv2.findContours(
                binary,
                cv2.RETR_EXTERNAL,
                cv2.CHAIN_APPROX_SIMPLE
            )

            for contour in contours:
                area = cv2.contourArea(contour)

                # Ignore tiny noise regions
                if area < 20:
                    continue

                epsilon = 0.002 * cv2.arcLength(contour, True)
                contour = cv2.approxPolyDP(contour, epsilon, True)

                if len(contour) < 3:
                    continue

                points = contour.reshape(-1, 2)

                coords = []
                for x, y in points:
                    coords.extend([x / w, y / h])

                lines.append(
                    str(cls) + " " +
                    " ".join(f"{v:.6f}" for v in coords)
                )

        output_name = mask_path.stem.replace("_lab", "") + ".txt"
        (label_dir / output_name).write_text(
            "\n".join(lines)
        )

        count += 1

    print(f"{split}: converted {count} masks")

print("YOLO segmentation labels ready.")
