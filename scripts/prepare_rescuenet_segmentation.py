from pathlib import Path
import shutil

SRC = Path("datasets/processed/RescueNet")
DST = Path("datasets/processed/RescueNetSeg")

for split in ["train", "val"]:
    (DST / split / "images").mkdir(parents=True, exist_ok=True)
    (DST / split / "masks").mkdir(parents=True, exist_ok=True)

def copy_split(src_img, src_mask, dst_split):
    count = 0

    for img in sorted(src_img.glob("*.jpg")):
        mask = src_mask / f"{img.stem}_lab.png"

        if mask.exists():
            shutil.copy2(img, DST / dst_split / "images" / img.name)
            shutil.copy2(mask, DST / dst_split / "masks" / mask.name)
            count += 1

    print(f"{dst_split}: {count} image/mask pairs")

copy_split(
    SRC / "validation/images",
    SRC / "validation/masks",
    "train"
)

copy_split(
    SRC / "test/images",
    SRC / "test/masks",
    "val"
)

print("Dataset ready:", DST)
