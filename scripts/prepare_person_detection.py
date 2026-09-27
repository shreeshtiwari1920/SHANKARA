from pathlib import Path
import shutil


BASE_DIR = Path("datasets")

OUTPUT_DIR = BASE_DIR / "processed/PersonDetection"


SOURCES = {
    "rgbt_train": {
        "images": BASE_DIR / "processed/RGBTDronePerson/train/visible",
        "labels": BASE_DIR / "processed/RGBTDronePerson/train/labels",
        "output_split": "train",
        "prefix": "rgbt",
    },
    "rgbt_val": {
        "images": BASE_DIR / "processed/RGBTDronePerson/val/visible",
        "labels": BASE_DIR / "processed/RGBTDronePerson/val/labels",
        "output_split": "val",
        "prefix": "rgbt",
    },
    "sard_train": {
        "images": BASE_DIR / "processed/SARD/train/images",
        "labels": BASE_DIR / "processed/SARD/train/labels",
        "output_split": "train",
        "prefix": "sard",
    },
    "sard_val": {
        "images": BASE_DIR / "processed/SARD/valid/images",
        "labels": BASE_DIR / "processed/SARD/valid/labels",
        "output_split": "val",
        "prefix": "sard",
    },
}


def filter_person_labels(label_file):
    """Keep only class 0 annotations and convert everything to class 0."""

    output_lines = []

    with open(label_file, "r") as f:
        for line in f:
            parts = line.strip().split()

            if len(parts) != 5:
                continue

            class_id = int(parts[0])

            # RGBTDronePerson:
            # 0 = person
            # 1 = rider
            # 2 = crowd
            #
            # SARD:
            # 0 = human

            if class_id != 0:
                continue

            # Force output class to 0
            output_lines.append(
                "0 " + " ".join(parts[1:])
            )

    return output_lines


def process_source(source_name, config):
    image_dir = config["images"]
    label_dir = config["labels"]

    split = config["output_split"]
    prefix = config["prefix"]

    output_images = OUTPUT_DIR / split / "images"
    output_labels = OUTPUT_DIR / split / "labels"

    image_files = sorted(image_dir.glob("*"))

    print(f"\nProcessing {source_name}")
    print(f"Images found: {len(image_files)}")

    processed = 0
    skipped = 0
    empty_labels = 0

    for image_file in image_files:

        if not image_file.is_file():
            continue

        label_file = label_dir / f"{image_file.stem}.txt"

        if not label_file.exists():
            print(f"Missing label: {image_file.name}")
            skipped += 1
            continue

        person_labels = filter_person_labels(label_file)

        # Skip images that contain no person annotations.
        if not person_labels:
            empty_labels += 1
            continue

        output_name = f"{prefix}_{image_file.name}"
        output_label_name = f"{prefix}_{image_file.stem}.txt"

        shutil.copy2(
            image_file,
            output_images / output_name
        )

        with open(
            output_labels / output_label_name,
            "w"
        ) as f:
            f.write("\n".join(person_labels) + "\n")

        processed += 1

    print(f"Processed: {processed}")
    print(f"Skipped: {skipped}")
    print(f"No-person images skipped: {empty_labels}")


def main():

    for config in SOURCES.values():
        process_source(
            config["prefix"],
            config
        )

    print("\nPerson detection dataset preparation complete.")


if __name__ == "__main__":
    main()