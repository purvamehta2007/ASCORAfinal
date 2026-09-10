import cv2
import mediapipe as mp

from mediapipe.tasks import python
from mediapipe.tasks.python import vision


MODEL_PATH = "hand_landmarker.task"


# Check model
import os

if not os.path.exists(MODEL_PATH):
    print("❌ hand_landmarker.task not found")
    print("Expected location:", os.path.abspath(MODEL_PATH))
    exit()

print("✅ Hand model found")


# MediaPipe setup
base_options = python.BaseOptions(
    model_asset_path=MODEL_PATH
)

options = vision.HandLandmarkerOptions(
    base_options=base_options,
    num_hands=3
)

detector = vision.HandLandmarker.create_from_options(options)

print("✅ MediaPipe hand detector initialized")


# Webcam
camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not camera.isOpened():
    print("❌ Webcam could not be opened")
    exit()

print("✅ Webcam opened")
print("✋ Show your hand to the camera")
print("Press Q to quit")


while True:

    success, frame = camera.read()

    if not success:
        print("❌ Could not read frame")
        break

    # Mirror image
    frame = cv2.flip(frame, 1)

    # Convert BGR → RGB
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # MediaPipe image
    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb_frame
    )

    # Detect hands
    result = detector.detect(mp_image)

    # Draw detected hands
    if result.hand_landmarks:

        for hand_landmarks in result.hand_landmarks:

            h, w, _ = frame.shape

            for landmark in hand_landmarks:

                x = int(landmark.x * w)
                y = int(landmark.y * h)

                cv2.circle(
                    frame,
                    (x, y),
                    5,
                    (0, 255, 0),
                    -1
                )

        cv2.putText(
            frame,
            f"Hands detected: {len(result.hand_landmarks)}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            2
        )

    else:

        cv2.putText(
            frame,
            "No hand detected",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            2
        )

    cv2.imshow(
        "ASCORA Hand Detection Test",
        frame
    )

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break


camera.release()
cv2.destroyAllWindows()

print("✅ Test finished")