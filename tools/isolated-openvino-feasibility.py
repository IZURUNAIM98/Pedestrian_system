import argparse
import hashlib
import json
import platform
import time
from pathlib import Path

import cv2
import numpy as np
import openvino as ov


def sha384(path: Path) -> str:
    digest = hashlib.sha384()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xml", required=True)
    parser.add_argument("--video", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--threshold", type=float, default=0.30)
    args = parser.parse_args()
    xml = Path(args.xml).resolve()
    video = Path(args.video).resolve()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    core = ov.Core()
    model = core.read_model(xml)
    compiled = core.compile_model(model, "CPU")
    infer = compiled.create_infer_request()
    input_port = model.input(0)
    input_shape = list(input_port.shape)
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video}")
    fps = cap.get(cv2.CAP_PROP_FPS)
    rows = []
    latencies = []
    frame_index = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        source_timestamp_ms = round((frame_index / fps) * 1000) if fps else round(cap.get(cv2.CAP_PROP_POS_MSEC))
        resized = cv2.resize(frame, (input_shape[3], input_shape[2]), interpolation=cv2.INTER_LINEAR)
        tensor = np.transpose(resized, (2, 0, 1))[None, ...]
        started = time.perf_counter_ns()
        result = infer.infer({input_port.any_name: tensor})
        elapsed_ms = (time.perf_counter_ns() - started) / 1_000_000
        latencies.append(elapsed_ms)
        output_tensor = next(iter(result.values()))
        detections = []
        for det_index, det in enumerate(np.asarray(output_tensor).reshape(-1, 7)):
            image_id, label, confidence, x_min, y_min, x_max, y_max = [float(value) for value in det]
            if int(label) != 0 or confidence < args.threshold:
                continue
            detections.append({"detectionId": f"f{frame_index:04d}-d{det_index:03d}", "frameIndex": frame_index, "timestampMs": source_timestamp_ms, "label": int(label), "confidence": confidence, "xMin": x_min, "yMin": y_min, "xMax": x_max, "yMax": y_max})
        rows.append({"frameId": f"f-{frame_index:04d}", "frameIndex": frame_index, "timestampMs": source_timestamp_ms, "detections": detections, "latencyMs": elapsed_ms, "preprocessing": {"resize": [input_shape[3], input_shape[2]], "colorOrder": "BGR", "layout": "NCHW", "dtype": "uint8"}})
        frame_index += 1
    cap.release()
    summary = {"runtime": {"openvino": ov.__version__, "opencv": cv2.__version__, "python": platform.python_version(), "platform": platform.platform()}, "model": {"xml": str(xml), "xmlSha384": sha384(xml), "inputShape": input_shape, "outputContract": "1x1x200x7; label 0 person"}, "video": {"path": str(video), "sha256": hashlib.sha256(video.read_bytes()).hexdigest(), "fps": fps, "frames": frame_index}, "threshold": args.threshold, "latencyMs": {"mean": sum(latencies) / len(latencies) if latencies else None, "min": min(latencies) if latencies else None, "max": max(latencies) if latencies else None}, "frames": rows}
    output.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(output), "frames": frame_index, "meanLatencyMs": summary["latencyMs"]["mean"], "detections": sum(len(row["detections"]) for row in rows)}))


if __name__ == "__main__":
    main()
