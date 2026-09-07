import os
import time
import requests
import cv2
import mediapipe as mp
from dotenv import load_dotenv


# ============================================================
# ASCORA CLASSROOM CONTROLLER
# Webcam → Hand Detection → Supabase Queue → FIFO Serving
# ============================================================

load_dotenv(".env.hardware")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
CLASSROOM_ID = os.getenv("ASCORA_CLASSROOM_ID", "main-classroom")
STUDENT_ID = os.getenv("ASCORA_STUDENT_ID")

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is missing from .env.hardware")

if not SUPABASE_ANON_KEY:
    raise RuntimeError("SUPABASE_ANON_KEY is missing from .env.hardware")

if not STUDENT_ID:
    raise RuntimeError("ASCORA_STUDENT_ID is missing from .env.hardware")


# ============================================================
# SUPABASE
# ============================================================

HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
}


def get_my_active_request():
    """Check whether this student already has an active request."""

    url = (
        f"{SUPABASE_URL}/rest/v1/doubt_queue"
        f"?student_id=eq.{STUDENT_ID}"
        f"&classroom_id=eq.{CLASSROOM_ID}"
        f"&status=in.(waiting,serving)"
        f"&select=id,status,raised_at"
        f"&limit=1"
    )

    try:
        response = requests.get(url, headers=HEADERS, timeout=10)

        if response.status_code != 200:
            print("Queue check error:", response.status_code)
            print(response.text)
            return None

        data = response.json()

        if data:
            return data[0]

        return None

    except requests.RequestException as e:
        print("Queue connection error:", e)
        return None


def raise_hand_request():
    """Create a doubt request for the configured student."""

    existing = get_my_active_request()

    if existing:
        print()
        print("⚠️ Student already has an active request.")
        print(f"Request ID: {existing['id']}")
        print(f"Status: {existing['status']}")
        return existing

    url = f"{SUPABASE_URL}/rest/v1/doubt_queue"

    payload = {
        "student_id": STUDENT_ID,
        "classroom_id": CLASSROOM_ID,
        "status": "waiting",
    }

    try:
        response = requests.post(
            url,
            headers={
                **HEADERS,
                "Prefer": "return=representation",
            },
            json=payload,
            timeout=10,
        )

        if response.status_code not in (200, 201):
            print()
            print("❌ Failed to raise hand")
            print("Status:", response.status_code)
            print(response.text)
            return None

        data = response.json()

        if isinstance(data, list) and data:
            request = data[0]

            print()
            print("============================================")
            print("🙋 HAND RAISED")
            print("============================================")
            print(f"Student ID: {request.get('student_id')}")
            print(f"Request ID: {request.get('id')}")
            print(f"Status: {request.get('status')}")
            print(f"Raised at: {request.get('raised_at')}")
            print("============================================")

            return request

        return None

    except requests.RequestException as e:
        print("❌ Supabase connection error:", e)
        return None


# ============================================================
# FIFO CONTROLLER
# ============================================================

def claim_next_student():
    """Ask Supabase to claim the oldest waiting student."""

    url = f"{SUPABASE_URL}/rest/v1/rpc/claim_next_doubt"

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
            print("RPC error:", response.status_code)
            print(response.text)
            return None

        data = response.json()

        if not data:
            return None

        # RPC can return a single object or a list.
        if isinstance(data, list):
            if not data:
                return None
            return data[0]

        return data

    except requests.RequestException as e:
        print("Controller connection error:", e)
        return None


# ============================================================
# HAND DETECTION
# ============================================================

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils


def is_hand_raised(hand_landmarks):
    """
    Basic raised-hand detection.

    We consider the hand raised when at least 3 fingers
    are above the wrist.
    """

    landmarks = hand_landmarks.landmark

    wrist_y = landmarks[mp_hands.HandLandmark.WRIST].y

    fingers = [
        mp_hands.HandLandmark.INDEX_FINGER_TIP,
        mp_hands.HandLandmark.MIDDLE_FINGER_TIP,
        mp_hands.HandLandmark.RING_FINGER_TIP,
        mp_hands.HandLandmark.PINKY_TIP,
    ]

    raised_count = 0

    for finger in fingers:
        if landmarks[finger].y < wrist_y:
            raised_count += 1

    return raised_count >= 3


# ============================================================
# MAIN CLASSROOM LOOP
# ============================================================

def main():

    print()
    print("============================================")
    print("        ASCORA CLASSROOM CONTROLLER")
    print("============================================")
    print(f"Classroom: {CLASSROOM_ID}")
    print(f"Student:   {STUDENT_ID}")
    print("============================================")
    print()
    print("Starting webcam...")
    print("Raise your hand to request a doubt.")
    print("Press Q to quit.")
    print()

    camera = cv2.VideoCapture(0)

    if not camera.isOpened():
        raise RuntimeError(
            "Could not open webcam. "
            "Check camera permissions or camera index."
        )

    # MediaPipe hand detector
    with mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6,
    ) as hands:

        hand_was_up = False
        last_detection_time = 0

        while True:

            success, frame = camera.read()

            if not success:
                print("⚠️ Could not read webcam frame.")
                continue

            # Flip for natural mirror view
            frame = cv2.flip(frame, 1)

            # Convert BGR → RGB
            rgb_frame = cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2RGB
            )

            results = hands.process(rgb_frame)

            raised = False

            if results.multi_hand_landmarks:

                for hand_landmarks in results.multi_hand_landmarks:

                    mp_drawing.draw_landmarks(
                        frame,
                        hand_landmarks,
                        mp_hands.HAND_CONNECTIONS
                    )

                    if is_hand_raised(hand_landmarks):
                        raised = True

            # ==================================================
            # NEW HAND RAISE
            # ==================================================

            if raised and not hand_was_up:

                current_time = time.time()

                # Small debounce
                if current_time - last_detection_time > 2:

                    print()
                    print("✋ Raised hand detected!")

                    request = raise_hand_request()

                    if request:
                        last_detection_time = current_time

                hand_was_up = True

            # ==================================================
            # HAND LOWERED
            # ==================================================

            if not raised:

                hand_was_up = False

            # ==================================================
            # CHECK FOR WAITING STUDENT
            # ==================================================

            # We don't need to claim every frame.
            # Check approximately once every 3 seconds.

            if int(time.time() * 10) % 30 == 0:

                active_request = get_my_active_request()

                if active_request:

                    if active_request["status"] == "waiting":

                        student = claim_next_student()

                        if student:

                            print()
                            print("============================================")
                            print("🎤 ASCORA SELECTED STUDENT")
                            print("============================================")
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
                            print("============================================")
                            print()

                            print(
                                "🎤 Student can now speak."
                            )

            # ==================================================
            # UI
            # ==================================================

            if raised:

                cv2.putText(
                    frame,
                    "HAND RAISED!",
                    (30, 50),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.1,
                    (0, 255, 0),
                    3,
                )

            else:

                cv2.putText(
                    frame,
                    "Raise your hand",
                    (30, 50),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.0,
                    (255, 255, 255),
                    2,
                )

            cv2.putText(
                frame,
                "ASCORA Classroom",
                (30, frame.shape[0] - 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2,
            )

            cv2.imshow(
                "ASCORA Classroom - Hand Detection",
                frame
            )

            # Quit with Q
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    camera.release()
    cv2.destroyAllWindows()

    print()
    print("ASCORA classroom controller stopped.")


if __name__ == "__main__":
    main()