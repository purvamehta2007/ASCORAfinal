import cv2

camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not camera.isOpened():
    print("❌ Webcam could not be opened")
    exit()

print("✅ Webcam opened successfully")
print("Press Q to close")

while True:
    success, frame = camera.read()

    if not success:
        print("❌ Could not read frame")
        break

    cv2.imshow("ASCORA Webcam Test", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

camera.release()
cv2.destroyAllWindows()