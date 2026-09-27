from ultralytics import YOLO
import cv2
import argparse
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Path to input video")
    parser.add_argument("--output", default="runs/poc/person_detection.mp4")
    parser.add_argument("--conf", type=float, default=0.25)
    args = parser.parse_args()

    model = YOLO(
        "runs/detect/runs/person_detection/sard_v1-2/weights/best.pt"
    )

    cap = cv2.VideoCapture(args.source)

    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {args.source}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    if fps <= 0:
        fps = 30

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(
        args.output,
        fourcc,
        fps,
        (width, height),
    )

    frame_count = 0
    start = time.time()

    while True:
        ret, frame = cap.read()

        if not ret:
            break

        results = model.predict(
            frame,
            conf=args.conf,
            device="mps",
            verbose=False,
        )

        annotated = results[0].plot()

        frame_count += 1

        elapsed = time.time() - start
        current_fps = frame_count / elapsed if elapsed > 0 else 0

        cv2.putText(
            annotated,
            f"FPS: {current_fps:.1f}",
            (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            2,
        )

        cv2.putText(
            annotated,
            f"Frame: {frame_count}",
            (20, 70),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            2,
        )

        writer.write(annotated)

    cap.release()
    writer.release()

    print(f"Processed frames: {frame_count}")
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
