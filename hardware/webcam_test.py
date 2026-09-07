
import cv2

print("OpenCV version:", cv2.__version__)
print("Opening webcam...")

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not cap.isOpened():
    print("❌ Could not open webcam.")
    print("Try changing VideoCapture(0) to VideoCapture(1).")
    exit()

print("✅ Webcam opened successfully.")
print("Press Q to quit.")

while True:
    ret, frame = cap.read()

    if not ret:
        print("❌ Could not read frame.")
        break

    cv2.imshow("ASCORA Webcam Test", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
