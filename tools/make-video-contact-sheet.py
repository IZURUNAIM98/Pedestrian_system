import argparse
from pathlib import Path
import cv2

parser = argparse.ArgumentParser(); parser.add_argument('--video', required=True); parser.add_argument('--output', required=True); args = parser.parse_args()
cap = cv2.VideoCapture(args.video); fps = cap.get(cv2.CAP_PROP_FPS); total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); indices = [round(i * (total - 1) / 11) for i in range(12)]
tiles = []
for index in indices:
    cap.set(cv2.CAP_PROP_POS_FRAMES, index); ok, frame = cap.read()
    if not ok: continue
    frame = cv2.resize(frame, (320, 180)); cv2.putText(frame, f'frame {index} / {index / fps:.1f}s', (8, 20), cv2.FONT_HERSHEY_SIMPLEX, .5, (0, 255, 255), 1, cv2.LINE_AA); tiles.append(frame)
cap.release()
sheet = cv2.vconcat([cv2.hconcat(tiles[row:row+4]) for row in range(0, len(tiles), 4)])
Path(args.output).parent.mkdir(parents=True, exist_ok=True); cv2.imwrite(args.output, sheet)
