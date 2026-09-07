import cv2
import mediapipe as mp
import time
import os
import requests
from dotenv import load_dotenv

from mediapipe.tasks import python
from mediapipe.tasks.python import vision


# ============================================
# LOAD CONFIGURATION
# ============================================

load_dotenv(".env.hardware")

STUDENT_ID = os.getenv("ASCORA_STUDENT_ID")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

CLASSROOM_ID = "main-classroom"


if not STUDENT_ID:
    print("ERROR: ASCORA_STUDENT_ID is missing.")
    exit()

if not SUPABASE_URL:
    print("ERROR: SUPABASE_URL is missing.")
    exit()

if not SUPABASE_KEY:
    print("ERROR: SUPABASE_ANON_KEY is missing.")
    exit()


# ============================================
# MEDIAPIPE MODEL
# ============================================

MODEL_PATH = "hand_landmarker.task"

if not os.path.exists(MODEL_PATH):
    print("ERROR: hand_landmarker.task not found.")
    print("Make sure the model is in the project root.")
    exit()


print("Loading MediaPipe hand model...")

base_options = python.BaseOptions(
    model_asset_path=MODEL_PATH
)

options = vision.HandLandmarkerOptions(
    base_options=base_options,
    num_hands=2,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5,
)

detector = vision.HandLandmarker.create_from_options(
    options
)

print("MediaPipe loaded successfully.")


# ============================================
# CAMERA
# ============================================

print("Opening webcam...")

camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not camera.isOpened():

    print("ERROR: Camera could not be opened.")

    detector.close()
    exit()


# Optional camera resolution
camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)


print("Webcam opened successfully.")

print("--------------------------------------------")
print("ASCORA Hand Detection + Queue")
print("--------------------------------------------")
print("Student:", STUDENT_ID)
print("Classroom:", CLASSROOM_ID)
print()
print("Raise your hand to join the ASCORA queue.")
print("Press Q to quit.")
print("--------------------------------------------")


# ============================================
# STATE
# ============================================

hand_raised = False
last_event_time = 0

COOLDOWN = 5


# ============================================
# HAND RAISE DETECTION
# ============================================

def is_hand_raised(landmarks):

    wrist_y = landmarks[0].y

    index_y = landmarks[8].y
    middle_y = landmarks[12].y
    ring_y = landmarks[16].y
    pinky_y = landmarks[20].y

    fingers_up = sum([
        index_y < wrist_y,
        middle_y < wrist_y,
        ring_y < wrist_y,
        pinky_y < wrist_y,
    ])

    return fingers_up >= 3


# ============================================
# SEND EVENT TO SUPABASE
# ============================================

def raise_hand():

    url = f"{SUPABASE_URL}/rest/v1/doubt_queue"

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    payload = {
        "student_id": STUDENT_ID,
        "classroom_id": CLASSROOM_ID,
        "status": "waiting",
    }

    try:

        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=10,
        )

        if response.status_code in (200, 201):

            print()
            print("============================================")
            print("HAND RAISED → ADDED TO ASCORA QUEUE")
            print("============================================")
            print(response.json())
            print()

            return True

        print()
        print("QUEUE ERROR")
        print("Status:", response.status_code)
        print("Response:", response.text)
        print()

        return False

    except requests.RequestException as error:

        print()
        print("NETWORK ERROR:", error)
        print()

        return False


# ============================================
# MAIN LOOP
# ============================================

while True:

    success, frame = camera.read()

    if not success:

        print("ERROR: Could not read camera frame.")
        break


    # Mirror camera
    frame = cv2.flip(frame, 1)


    # BGR → RGB
    rgb_frame = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )


    # MediaPipe image
    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb_frame
    )


    # Detect hands
    results = detector.detect(mp_image)


    detected = False


    # ========================================
    # PROCESS DETECTED HANDS
    # ========================================

    if results.hand_landmarks:

        for landmarks in results.hand_landmarks:

            # Draw landmarks
            for landmark in landmarks:

                x = int(
                    landmark.x * frame.shape[1]
                )

                y = int(
                    landmark.y * frame.shape[0]
                )

                cv2.circle(
                    frame,
                    (x, y),
                    4,
                    (0, 255, 0),
                    -1
                )


            # Check raised hand
            if is_hand_raised(landmarks):

                detected = True


    # ========================================
    # HANDLE RAISE EVENT
    # ========================================

    current_time = time.time()


    if detected:

        if (
            not hand_raised
            and current_time - last_event_time > COOLDOWN
        ):

            hand_raised = True
            last_event_time = current_time

            print("🙋 HAND RAISED!")

            raise_hand()


        cv2.putText(
            frame,
            "HAND RAISED",
            (30, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            3
        )


    else:

        hand_raised = False

        cv2.putText(
            frame,
            "Waiting for hand...",
            (30, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (255, 255, 255),
            2
        )


    # ========================================
    # SHOW HAND COUNT
    # ========================================

    hand_count = len(results.hand_landmarks)

    cv2.putText(
        frame,
        f"Hands detected: {hand_count}",
        (30, 90),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2
    )


    # ========================================
    # DISPLAY
    # ========================================

    cv2.imshow(
        "ASCORA - Hand Detection",
        frame
    )


    # ========================================
    # EXIT
    # ========================================

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break


# ============================================
# CLEANUP
# ============================================

camera.release()
cv2.destroyAllWindows()
detector.close()

print("ASCORA Hand Detection Stopped.")
