# Isolated model feasibility log

Date: 2026-09-29  
Repository commit inspected: `b0938e7c47302585837e34a10f0298255c732d4d`

## Environment checks

| Check | Result |
|---|---|
| OS | Windows workspace; exact OS build not captured |
| Bundled Node | v24.14.0 |
| Bundled Python | 3.13.15 |
| `openvino` import | OpenVINO 2026.4.0 |
| `cv2` import | OpenCV 5.0.0 |
| `av` import | not required; OpenCV decoded MP4 |
| Model artifact | Official FP32 XML/BIN obtained and hashed |
| Video fixture | Official Open Model Zoo `people-detection.mp4`, hash recorded; terms require review |

Observed command:

```powershell
$py = (Resolve-Path '.tools\\python-3.13.15\\python.exe').Path
& $py -c "import importlib.util; print('openvino=', bool(importlib.util.find_spec('openvino'))); print('cv2=', bool(importlib.util.find_spec('cv2'))); print('av=', bool(importlib.util.find_spec('av')))"
```

Observed result:

```text
openvino= False
cv2= False
av= False
```

## Installation and inference commands

```powershell
$py = (Resolve-Path '.tools\\python-3.13.15\\python.exe').Path
& $py -m venv '.artifact_runtime\\openvino-20260929'
& '.artifact_runtime\\openvino-20260929\\Scripts\\python.exe' -m pip install openvino==2026.4.0 opencv-python-headless==5.0.0.93
& '.artifact_runtime\\openvino-20260929\\Scripts\\python.exe' tools\\isolated-openvino-feasibility.py `
  --xml '.artifact_runtime\\openvino-20260929\\model\\FP32\\person-detection-0200.xml' `
  --video '.artifact_runtime\\openvino-20260929\\fixture\\people-detection.mp4' `
  --output '.artifact_runtime\\openvino-20260929\\evidence\\raw-inference.json' `
  --threshold 0.30
```

The first attempt included `openvino-dev`; dependency resolution selected legacy releases and began downloading an incompatible SciPy source package, so that attempt was stopped. The successful isolated runtime install intentionally used the pinned OpenVINO runtime and OpenCV decoder only. No model-downloader package was used; the model files came from the exact official storage URLs recorded in the decision record.

## Feasibility result

The model loaded successfully on CPU and produced real detections for all 596 frames. The raw evidence file contains 343 detections at threshold 0.30. Mean inference latency was 4.4528 ms per frame, minimum 2.6765 ms and maximum 17.0825 ms. Preprocessing used resize to 256x256, BGR channel order, NCHW layout and uint8 input. Output decoding observed the documented 7-value SSD rows and class 0 person mapping.

## Reproducible follow-up experiment after approval

1. Pin the Open Model Zoo commit and download through `omz_downloader` from the official repository tooling.
2. Record the exact `.xml` and `.bin` SHA-256 values.
3. Install the approved OpenVINO runtime and video decoder in an isolated environment.
4. Run a loader smoke test against one decoded frame.
5. Run the permitted fixture through the detector, recording source timestamps, model version, confidence, output coordinates and per-frame latency.
6. Compare only against the independent annotation file; report sample size, misses, false detections and occlusion failures.

The experiment must fail visibly on missing weights, runtime, decoder or corrupt frames and must never fall back to hand-authored boxes. The current official clip is not a crossing fixture; detection accuracy, misses and false detections are **NOT MEASURED**.
