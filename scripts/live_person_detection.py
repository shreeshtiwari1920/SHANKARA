from ultralytics import YOLO
import cv2
import time

MODEL_PATH = "runs/detect/runs/person_detection/sard_v1-2/weights/best.pt"

model = YOLO(MODEL_PATH)

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise RuntimeError("Could not open camera")

prev_time = time.time()

while True:
    ret, frame = cap.read()

    if not ret:
        print("Could not read frame")
        break

    results = model.predict(
        frame,
        conf=0.25,
        device="mps",
        verbose=False,
    )

    annotated = results[0].plot()

    current_time = time.time()
    fps = 1 / (current_time - prev_time)
    prev_time = current_time

    cv2.putText(
        annotated,
        f"FPS: {fps:.1f}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 255, 0),
        2,
    )

    cv2.imshow("Disaster Drone - Person Detection", annotated)

    # Press Q to quit
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
