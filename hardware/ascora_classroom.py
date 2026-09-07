import os
import time
from pathlib import Path

import cv2
import requests
import mediapipe as mp
from dotenv import load_dotenv


# ============================================================
# ASCORA MULTI-STUDENT CLASSROOM CONTROLLER
#
# Webcam
#   ↓
# MediaPipe Hand Landmarker
#   ↓
# Camera Zone
#   ↓
# Student A / B / C
#   ↓
# Supabase Doubt Queue
#   ↓
# FIFO Serving
#
# This version uses MediaPipe Tasks API.
# ============================================================


# ============================================================
# LOAD ENVIRONMENT
# ============================================================

load_dotenv(".env.hardware")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

CLASSROOM_ID = os.getenv(
    "ASCORA_CLASSROOM_ID",
    "main-classroom"
)

STUDENT_A_ID = os.getenv("ASCORA_STUDENT_A_ID")
STUDENT_B_ID = os.getenv("ASCORA_STUDENT_B_ID")
STUDENT_C_ID = os.getenv("ASCORA_STUDENT_C_ID")


# ============================================================
# VALIDATE ENVIRONMENT
# ============================================================

if not SUPABASE_URL:
    raise RuntimeError(
        "SUPABASE_URL is missing from .env.hardware"
    )

if not SUPABASE_ANON_KEY:
    raise RuntimeError(
        "SUPABASE_ANON_KEY is missing from .env.hardware"
    )

if not STUDENT_A_ID:
    raise RuntimeError(
        "ASCORA_STUDENT_A_ID is missing from .env.hardware"
    )

if not STUDENT_B_ID:
    raise RuntimeError(
        "ASCORA_STUDENT_B_ID is missing from .env.hardware"
    )

if not STUDENT_C_ID:
    raise RuntimeError(
        "ASCORA_STUDENT_C_ID is missing from .env.hardware"
    )


# ============================================================
# HAND LANDMARK MODEL
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR.parent / "hand_landmarker.task"

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Could not find hand_landmarker.task at:\n"
        f"{MODEL_PATH}"
    )


# ============================================================
# STUDENT ZONES
#
# Camera image:
#
# ┌─────────────────────────────────────────────┐
# │                                             │
# │  STUDENT A  │   STUDENT B   │  STUDENT C   │
# │     LEFT    │    CENTER     │    RIGHT     │
# │             │               │              │
# └─────────────────────────────────────────────┘
#
# x = 0.0 -------------------------------> 1.0
# ============================================================

STUDENT_ZONES = {
    "A": {
        "name": "Student A",
        "student_id": STUDENT_A_ID,
        "x_min": 0.00,
        "x_max": 0.33,
    },

    "B": {
        "name": "Student B",
        "student_id": STUDENT_B_ID,
        "x_min": 0.33,
        "x_max": 0.66,
    },

    "C": {
        "name": "Student C",
        "student_id": STUDENT_C_ID,
        "x_min": 0.66,
        "x_max": 1.00,
    },
}


# ============================================================
# SUPABASE HEADERS
# ============================================================

HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
}


# ============================================================
# SUPABASE — CHECK ACTIVE REQUEST
# ============================================================

def get_active_request(student_id):
    """
    Check whether a student already has a waiting/serving request.

    This prevents duplicate requests while the student keeps
    their hand raised.
    """

    url = (
        f"{SUPABASE_URL}/rest/v1/doubt_queue"
        f"?student_id=eq.{student_id}"
        f"&classroom_id=eq.{CLASSROOM_ID}"
        f"&status=in.(waiting,serving)"
        f"&select=id,student_id,status,raised_at"
        f"&limit=1"
    )

    try:

        response = requests.get(
            url,
            headers=HEADERS,
            timeout=10,
        )

        if response.status_code != 200:

            print(
                "Queue check error:",
                response.status_code
            )

            print(response.text)

            return None

        data = response.json()

        if data:
            return data[0]

        return None

    except requests.RequestException as error:

        print(
            "Supabase connection error:",
            error
        )

        return None


# ============================================================
# SUPABASE — RAISE DOUBT
# ============================================================

def raise_doubt(student_id, student_name):
    """
    Add a student to the classroom doubt queue.
    """

    # --------------------------------------------------------
    # Prevent duplicate active requests.
    # --------------------------------------------------------

    existing = get_active_request(student_id)

    if existing:

        print()
        print(
            f"⚠️ {student_name} already has an active request."
        )

        print(
            f"Status: {existing.get('status')}"
        )

        return existing

    # --------------------------------------------------------
    # Create new queue request.
    # --------------------------------------------------------

    url = (
        f"{SUPABASE_URL}/rest/v1/doubt_queue"
    )

    payload = {
        "student_id": student_id,
        "classroom_id": CLASSROOM_ID,
        "status": "waiting",
    }

    request_headers = {
        **HEADERS,
        "Prefer": "return=representation",
    }

    try:

        response = requests.post(
            url,
            headers=request_headers,
            json=payload,
            timeout=10,
        )

        if response.status_code not in (200, 201):

            print()
            print(
                "❌ Failed to create doubt request"
            )

            print(
                "Student:",
                student_name
            )

            print(
                "Status:",
                response.status_code
            )

            print(response.text)

            return None

        data = response.json()

        if isinstance(data, list) and data:

            request = data[0]

            print()
            print(
                "============================================"
            )

            print(
                "🙋 HAND RAISED"
            )

            print(
                "============================================"
            )

            print(
                f"Student:    {student_name}"
            )

            print(
                f"Student ID: {student_id}"
            )

            print(
                f"Request ID: {request.get('id')}"
            )

            print(
                f"Status:     {request.get('status')}"
            )

            print(
                f"Raised at:  {request.get('raised_at')}"
            )

            print(
                "============================================"
            )

            return request

        return None

    except requests.RequestException as error:

        print(
            "Supabase request error:",
            error
        )

        return None


# ============================================================
# SUPABASE — CLAIM NEXT STUDENT
# ============================================================

def claim_next_student():
    """
    Claim the oldest waiting student using the existing
    Supabase FIFO RPC.
    """

    url = (
        f"{SUPABASE_URL}/rest/v1/rpc/"
        f"claim_next_doubt"
    )

    payload = {
        "p_classroom_id": CLASSROOM_ID
    }

    try:

        response = requests.post(
            url,
            headers=HEADERS,
            json=payload,
            timeout=10,
        )

        if response.status_code != 200:

            print()
            print(
                "RPC error:",
                response.status_code
            )

            print(response.text)

            return None

        data = response.json()

        if not data:
            return None

        if isinstance(data, list):

            if not data:
                return None

            return data[0]

        return data

    except requests.RequestException as error:

        print(
            "Controller connection error:",
            error
        )

        return None


# ============================================================
# MEDIA PIPE HAND DETECTION
# ============================================================

BaseOptions = mp.tasks.BaseOptions

HandLandmarker = (
    mp.tasks.vision.HandLandmarker
)

HandLandmarkerOptions = (
    mp.tasks.vision.HandLandmarkerOptions
)

VisionRunningMode = (
    mp.tasks.vision.RunningMode
)


# ============================================================
# HAND RAISED LOGIC
# ============================================================

def is_hand_raised(landmarks):
    """
    Determine whether a detected hand is raised.

    We use the wrist and four finger tips.

    If at least three fingers are above the wrist,
    we consider the hand raised.
    """

    wrist = landmarks[0]

    finger_tips = [
        landmarks[8],   # index
        landmarks[12],  # middle
        landmarks[16],  # ring
        landmarks[20],  # pinky
    ]

    raised_count = 0

    for tip in finger_tips:

        if tip.y < wrist.y:

            raised_count += 1

    return raised_count >= 3


# ============================================================
# DETERMINE STUDENT ZONE
# ============================================================

def get_student_zone(x):
    """
    Convert normalized x coordinate to A/B/C zone.
    """

    for zone_id, zone in STUDENT_ZONES.items():

        if (
            zone["x_min"]
            <= x
            < zone["x_max"]
        ):

            return zone_id

    return None


# ============================================================
# DRAW CLASSROOM ZONES
# ============================================================

def draw_zone_overlay(frame):

    height, width = frame.shape[:2]

    # --------------------------------------------------------
    # Zone boundaries
    # --------------------------------------------------------

    x1 = int(width * 0.33)

    x2 = int(width * 0.66)

    cv2.line(
        frame,
        (x1, 0),
        (x1, height),
        (255, 255, 255),
        2,
    )

    cv2.line(
        frame,
        (x2, 0),
        (x2, height),
        (255, 255, 255),
        2,
    )

    # --------------------------------------------------------
    # Labels
    # --------------------------------------------------------

    cv2.putText(
        frame,
        "STUDENT A",
        (30, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (255, 255, 255),
        2,
    )

    cv2.putText(
        frame,
        "STUDENT B",
        (x1 + 30, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (255, 255, 255),
        2,
    )

    cv2.putText(
        frame,
        "STUDENT C",
        (x2 + 30, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (255, 255, 255),
        2,
    )


# ============================================================
# MAIN CLASSROOM LOOP
# ============================================================

def main():

    print()
    print(
        "============================================"
    )

    print(
        "      ASCORA MULTI-STUDENT CLASSROOM"
    )

    print(
        "============================================"
    )

    print(
        f"Classroom: {CLASSROOM_ID}"
    )

    print()

    print(
        "Student A → LEFT"
    )

    print(
        "Student B → CENTER"
    )

    print(
        "Student C → RIGHT"
    )

    print()

    print(
        "Raise your hand to ask a doubt."
    )

    print(
        "Press Q to quit."
    )

    print(
        "============================================"
    )

    print()

    # ========================================================
    # CAMERA
    # ========================================================

    camera = cv2.VideoCapture(0)

    if not camera.isOpened():

        raise RuntimeError(
            "Could not open webcam."
        )

    # ========================================================
    # HAND STATE
    # ========================================================

    hand_is_up = {
        "A": False,
        "B": False,
        "C": False,
    }

    last_raise_time = {
        "A": 0,
        "B": 0,
        "C": 0,
    }

    # ========================================================
    # QUEUE CHECK TIMER
    # ========================================================

    last_queue_check = 0

    # ========================================================
    # MEDIAPIPE CONFIGURATION
    # ========================================================

    base_options = BaseOptions(
        model_asset_path=str(MODEL_PATH)
    )

    options = HandLandmarkerOptions(
        base_options=base_options,
        running_mode=VisionRunningMode.VIDEO,
        num_hands=3,
        min_hand_detection_confidence=0.6,
        min_hand_presence_confidence=0.6,
        min_tracking_confidence=0.6,
    )

    # ========================================================
    # CREATE HAND LANDMARKER
    # ========================================================

    with HandLandmarker.create_from_options(
        options
    ) as landmarker:

        frame_timestamp = 0

        while True:

            # ==================================================
            # READ CAMERA
            # ==================================================

            success, frame = camera.read()

            if not success:

                print(
                    "⚠️ Could not read webcam frame."
                )

                continue

            # ==================================================
            # MIRROR CAMERA
            # ==================================================

            frame = cv2.flip(
                frame,
                1
            )

            height, width = frame.shape[:2]

            # ==================================================
            # CONVERT OPENCV → MEDIAPIPE IMAGE
            # ==================================================

            rgb_frame = cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2RGB
            )

            mp_image = mp.Image(
                image_format=(
                    mp.ImageFormat.SRGB
                ),
                data=rgb_frame,
            )

            # ==================================================
            # TIMESTAMP
            # ==================================================

            frame_timestamp += 33

            # ==================================================
            # HAND LANDMARK DETECTION
            # ==================================================

            results = landmarker.detect_for_video(
                mp_image,
                frame_timestamp,
            )

            detected_zones = set()

            # ==================================================
            # PROCESS EACH DETECTED HAND
            # ==================================================

            if results.hand_landmarks:

                for landmarks in results.hand_landmarks:

                    # ------------------------------------------
                    # Check whether hand is raised
                    # ------------------------------------------

                    if not is_hand_raised(
                        landmarks
                    ):

                        continue

                    # ------------------------------------------
                    # Wrist position
                    # ------------------------------------------

                    wrist = landmarks[0]

                    x = wrist.x
                    y = wrist.y

                    # ------------------------------------------
                    # Determine classroom zone
                    # ------------------------------------------

                    zone_id = get_student_zone(x)

                    if zone_id is None:

                        continue

                    detected_zones.add(
                        zone_id
                    )

                    zone = STUDENT_ZONES[
                        zone_id
                    ]

                    # ------------------------------------------
                    # Draw detection point
                    # ------------------------------------------

                    px = int(x * width)
                    py = int(y * height)

                    cv2.circle(
                        frame,
                        (px, py),
                        12,
                        (0, 255, 0),
                        -1,
                    )

                    cv2.putText(
                        frame,
                        zone["name"],
                        (
                            max(px - 70, 10),
                            max(py - 20, 20),
                        ),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (0, 255, 0),
                        2,
                    )

                    # ==========================================
                    # NEW HAND RAISE
                    # ==========================================

                    if not hand_is_up[zone_id]:

                        current_time = time.time()

                        # Debounce.
                        if (
                            current_time
                            - last_raise_time[zone_id]
                            > 2
                        ):

                            print()
                            print(
                                f"✋ {zone['name']} "
                                f"raised their hand."
                            )

                            request = raise_doubt(
                                zone["student_id"],
                                zone["name"],
                            )

                            if request:

                                last_raise_time[
                                    zone_id
                                ] = current_time

                        hand_is_up[
                            zone_id
                        ] = True

            # ==================================================
            # RESET HAND STATE
            # ==================================================

            for zone_id in hand_is_up:

                if (
                    zone_id
                    not in detected_zones
                ):

                    hand_is_up[
                        zone_id
                    ] = False

            # ==================================================
            # FIFO QUEUE
            # ==================================================

            current_time = time.time()

            if (
                current_time
                - last_queue_check
                >= 2
            ):

                last_queue_check = (
                    current_time
                )

                student = (
                    claim_next_student()
                )

                if student:

                    print()

                    print(
                        "============================================"
                    )

                    print(
                        "🎤 ASCORA SELECTED NEXT STUDENT"
                    )

                    print(
                        "============================================"
                    )

                    print(
                        f"Student ID: "
                        f"{student.get('student_id')}"
                    )

                    print(
                        f"Request ID: "
                        f"{student.get('id')}"
                    )

                    print(
                        f"Status: "
                        f"{student.get('status')}"
                    )

                    print(
                        "============================================"
                    )

                    print(
                        "🎤 Student can now speak."
                    )

                    print()

            # ==================================================
            # CAMERA UI
            # ==================================================

            draw_zone_overlay(
                frame
            )

            if detected_zones:

                cv2.putText(
                    frame,
                    "HAND RAISED!",
                    (30, 75),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.95,
                    (0, 255, 0),
                    3,
                )

            else:

                cv2.putText(
                    frame,
                    "Raise your hand",
                    (30, 75),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.85,
                    (255, 255, 255),
                    2,
                )

            # --------------------------------------------------
            # Footer
            # --------------------------------------------------

            cv2.putText(
                frame,
                "ASCORA Classroom | Press Q to quit",
                (
                    30,
                    height - 20,
                ),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (255, 255, 255),
                2,
            )

            # ==================================================
            # SHOW CAMERA
            # ==================================================

            cv2.imshow(
                "ASCORA - Multi Student Classroom",
                frame,
            )

            # ==================================================
            # QUIT
            # ==================================================

            key = cv2.waitKey(1) & 0xFF

            if key == ord("q"):

                break

    # ========================================================
    # CLEANUP
    # ========================================================

    camera.release()

    cv2.destroyAllWindows()

    print()

    print(
        "ASCORA classroom controller stopped."
    )


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()