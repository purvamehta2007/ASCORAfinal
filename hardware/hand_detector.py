import cv2
import mediapipe as mp
import time
import os
import requests

from dotenv import load_dotenv
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

ENV_PATH = os.path.join(BASE_DIR, ".env.hardware")
load_dotenv(ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

STUDENT_A_ID = os.getenv("ASCORA_STUDENT_A_ID")
STUDENT_B_ID = os.getenv("ASCORA_STUDENT_B_ID")
STUDENT_C_ID = os.getenv("ASCORA_STUDENT_C_ID")

CLASSROOM_ID = "main-classroom"

MODEL_PATH = os.path.join(
    PROJECT_ROOT,
    "hand_landmarker.task"
)


# ============================================================
# STUDENTS
# ============================================================

students = {
    "A": STUDENT_A_ID,
    "B": STUDENT_B_ID,
    "C": STUDENT_C_ID,
}


# ============================================================
# CHECK CONFIGURATION
# ============================================================

print("========================================")
print("        ASCORA HAND DETECTOR")
print("========================================")

if not SUPABASE_URL:
    print("❌ SUPABASE_URL is missing")
    exit()

if not SUPABASE_KEY:
    print("❌ SUPABASE_ANON_KEY is missing")
    exit()

for name, student_id in students.items():

    if not student_id:
        print(f"❌ ASCORA_STUDENT_{name}_ID is missing")
        exit()

print("✅ Supabase configuration loaded")
print("✅ Student A configured")
print("✅ Student B configured")
print("✅ Student C configured")


# ============================================================
# MEDIAPIPE MODEL
# ============================================================

if not os.path.exists(MODEL_PATH):

    print("❌ hand_landmarker.task not found")
    print("Expected location:", MODEL_PATH)
    exit()

print("✅ Hand model found")


base_options = python.BaseOptions(
    model_asset_path=MODEL_PATH
)

options = vision.HandLandmarkerOptions(
    base_options=base_options,
    num_hands=3
)

detector = vision.HandLandmarker.create_from_options(
    options
)

print("✅ MediaPipe initialized")


# ============================================================
# SUPABASE HEADERS
# ============================================================

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


# ============================================================
# HAND RAISE SETTINGS
# ============================================================

RAISE_CONFIRMATION_TIME = 0.5


# Tracks when a student's hand first becomes raised
raised_since = {
    "A": None,
    "B": None,
    "C": None,
}


# Prevents repeated insertion while hand stays raised
already_queued = {
    "A": False,
    "B": False,
    "C": False,
}


# ============================================================
# STUDENT ZONE
# ============================================================

def get_student_zone(center_x, frame_width):

    zone_width = frame_width / 3

    if center_x < zone_width:
        return "A"

    elif center_x < zone_width * 2:
        return "B"

    else:
        return "C"


# ============================================================
# RAISED HAND DETECTION
# ============================================================

def is_hand_raised(hand_landmarks):

    wrist = hand_landmarks[0]

    finger_tips = [
        hand_landmarks[8],   # Index
        hand_landmarks[12],  # Middle
        hand_landmarks[16],  # Ring
        hand_landmarks[20],  # Pinky
    ]

    fingers_up = sum(
        finger.y < wrist.y
        for finger in finger_tips
    )

    return fingers_up >= 3


# ============================================================
# SEND REQUEST TO SUPABASE
# ============================================================

def raise_hand(student_name):

    student_id = students[student_name]

    url = f"{SUPABASE_URL}/rest/v1/doubt_queue"

    payload = {
        "student_id": student_id,
        "classroom_id": CLASSROOM_ID,
        "status": "waiting",
    }

    try:

        response = requests.post(
            url,
            headers=HEADERS,
            json=payload,
            timeout=5,
        )

        if response.status_code in (200, 201):

            print(
                f"✋ Student {student_name} "
                f"joined the doubt queue"
            )

            return True

        elif response.status_code == 409:

            print(
                f"ℹ️ Student {student_name} "
                f"is already in the active queue"
            )

            # Treat this as already registered.
            return True

        else:

            print(
                f"❌ Supabase error for Student "
                f"{student_name}: {response.status_code}"
            )

            print(response.text)

            return False

    except requests.RequestException as error:

        print(
            f"❌ Network error for Student "
            f"{student_name}: {error}"
        )

        return False


# ============================================================
# OPEN WEBCAM
# ============================================================

camera = cv2.VideoCapture(
    0,
    cv2.CAP_DSHOW
)

if not camera.isOpened():

    print("❌ Webcam could not be opened")
    exit()

print("✅ Webcam opened")
print()
print("Student zones:")
print("A = LEFT")
print("B = CENTER")
print("C = RIGHT")
print()
print("Raise your hand to join the queue.")
print("Press Q to quit.")
print()


# ============================================================
# MAIN LOOP
# ============================================================

try:

    while True:

        success, frame = camera.read()

        if not success:

            print("❌ Could not read webcam frame")
            break

        # Mirror webcam
        frame = cv2.flip(frame, 1)

        frame_height, frame_width, _ = frame.shape


        # ====================================================
        # DRAW STUDENT ZONES
        # ====================================================

        zone_1 = frame_width // 3
        zone_2 = (frame_width // 3) * 2

        cv2.line(
            frame,
            (zone_1, 0),
            (zone_1, frame_height),
            (255, 255, 255),
            2
        )

        cv2.line(
            frame,
            (zone_2, 0),
            (zone_2, frame_height),
            (255, 255, 255),
            2
        )

        cv2.putText(
            frame,
            "STUDENT A",
            (40, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 255),
            2
        )

        cv2.putText(
            frame,
            "STUDENT B",
            (zone_1 + 40, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 255),
            2
        )

        cv2.putText(
            frame,
            "STUDENT C",
            (zone_2 + 40, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 255),
            2
        )


        # ====================================================
        # MEDIA PIPE DETECTION
        # ====================================================

        rgb_frame = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )

        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb_frame
        )

        result = detector.detect(mp_image)


        current_time = time.time()

        currently_raised = {
            "A": False,
            "B": False,
            "C": False,
        }


        # ====================================================
        # PROCESS HANDS
        # ====================================================

        if result.hand_landmarks:

            for hand_landmarks in result.hand_landmarks:

                xs = [
                    landmark.x
                    for landmark in hand_landmarks
                ]

                ys = [
                    landmark.y
                    for landmark in hand_landmarks
                ]

                center_x = sum(xs) / len(xs)
                center_y = sum(ys) / len(ys)

                pixel_x = int(
                    center_x * frame_width
                )

                pixel_y = int(
                    center_y * frame_height
                )


                student = get_student_zone(
                    pixel_x,
                    frame_width
                )


                raised = is_hand_raised(
                    hand_landmarks
                )


                # Draw landmarks
                for landmark in hand_landmarks:

                    x = int(
                        landmark.x * frame_width
                    )

                    y = int(
                        landmark.y * frame_height
                    )

                    cv2.circle(
                        frame,
                        (x, y),
                        4,
                        (0, 255, 0),
                        -1
                    )


                # =================================================
                # HAND IS RAISED
                # =================================================

                if raised:

                    currently_raised[student] = True


                    cv2.putText(
                        frame,
                        f"Student {student} RAISED",
                        (
                            max(pixel_x - 100, 10),
                            min(
                                pixel_y + 100,
                                frame_height - 20
                            )
                        ),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (0, 255, 0),
                        2
                    )


                    # Start timer
                    if raised_since[student] is None:

                        raised_since[student] = current_time


                    # Confirm sustained hand raise
                    elif (
                        current_time
                        - raised_since[student]
                        >= RAISE_CONFIRMATION_TIME
                    ):

                        # IMPORTANT:
                        # Only submit once per hand raise.
                        if not already_queued[student]:

                            success = raise_hand(
                                student
                            )

                            if success:

                                already_queued[student] = True

                                print(
                                    f"Student {student} "
                                    f"registered for this "
                                    f"hand raise."
                                )


        # ====================================================
        # HAND LOWERED
        # ====================================================

        for student in students:

            if not currently_raised[student]:

                raised_since[student] = None

                # Allow another request next time
                # the student raises their hand.
                already_queued[student] = False


        # ====================================================
        # DISPLAY STATUS
        # ====================================================

        y_position = 80

        for student in students:

            if currently_raised[student]:

                cv2.putText(
                    frame,
                    f"{student}: HAND RAISED",
                    (20, y_position),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 0),
                    2
                )

            y_position += 30


        cv2.imshow(
            "ASCORA Classroom Hand Detection",
            frame
        )


        # ====================================================
        # QUIT
        # ====================================================

        if cv2.waitKey(1) & 0xFF == ord("q"):

            break


finally:

    camera.release()
    cv2.destroyAllWindows()

    print()
    print("✅ ASCORA hand detector stopped")