# SmartCross offline AI Replay model decision record

Decision status: **PENDING EVIDENCE**  
Candidate: OpenVINO Model Zoo `person-detection-0200`  
Purpose: offline development and replay demonstration only  
Project owner: ____________________  
Decision date: ____________________  
Approval reference: ____________________

## Candidate and primary-source record

The official Open Model Zoo record describes `person-detection-0200` as a MobileNetV2-based SSD person detector with 256x256 resolution, 0.786 GFLOPs and 1.817 M parameters. Its documented input is `image`, shape `1x3x256x256`, NCHW, BGR. Its output is `1x1x200x7`; each row is `[image_id, label, confidence, x_min, y_min, x_max, y_max]`, with label `0` meaning person. These values are taken from the official model record, not inferred from test data.

Sources:

- Model specification: https://github.com/openvinotoolkit/open_model_zoo/tree/master/models/intel/person-detection-0200
- OpenVINO model documentation: https://docs.openvino.ai/2023.3/omz_models_model_person_detection_0200.html
- Open Model Zoo downloader/converter path: https://github.com/openvinotoolkit/open_model_zoo/blob/master/demos/object_detection_demo/python/README.md
- Open Model Zoo repository license: Apache License 2.0 at https://github.com/openvinotoolkit/open_model_zoo/blob/master/LICENSE

## Artifact and runtime evidence

| Item | Required record | Current status |
|---|---|---|
| Exact model release/commit | Open Model Zoo model metadata `2023.0/models_bin/1` | Pinned to official storage URLs; repository commit not captured |
| Required artifacts | FP32 XML IR and BIN weights | Obtained from official OpenVINO storage |
| Artifact SHA-256 / SHA-384 | XML `bb0cf8c9e4c1b4de5204ccb7490c419aee0a8108ce6c775531b54cd254f7175b` / `c615231e6fc865bd875e95c283d115e9ee9742ef02910b8752fe4b60724b1b5e198ed564ade0372109cd7abe9eed43ae`; BIN `95484b917605776d7f17ce133d7f44c3a10ca9c708924262da6a87550ce647c9` / `fdf355324c0603bd6e917067fe07581792fa48aeb5f47a031f3ed2773c541051712a3e2bf03cc681baa9ad6900d9f147` | Verified locally |
| Runtime | OpenVINO 2026.4.0, Python 3.13.15, OpenCV 5.0.0, NumPy 2.5.3 | Installed in isolated environment |
| Loader/inference test | 596 real video frames, CPU device | Passed |
| Latency | Mean 4.4528 ms; min 2.6765 ms; max 17.0825 ms; threshold 0.30 | Measured on this environment |

Evidence location: `.artifact_runtime/openvino-20260929/model/FP32/` and `.artifact_runtime/openvino-20260929/evidence/raw-inference.json`. The raw output contains 596 timestamped frame records and 343 decoded person detections. The model loaded and produced real output on CPU.

## License assessment

Open Model Zoo repository code and the model metadata identify Apache-2.0. The XML/BIN files contain no separate embedded notice that was independently inspected. Runtime packages report OpenCV Apache 2.0; OpenVINO package license metadata was not exposed by the local `pip show` output. **LICENSE REVIEW REQUIRED** for the exact weight redistribution terms, runtime notices and any upstream training/data terms before owner approval.

## Preprocessing and output contract for approval

Resize the decoded frame to 256x256, preserve BGR channel order, arrange as float32 NCHW `1x3x256x256`, and apply only transformations documented by the pinned model/runtime record. Decode output rows with class `0`, discard non-person rows, reject coordinates outside `[0,1]`, retain confidence and source timestamp, and map normalized coordinates to the existing `PedestrianDetection` envelope. The confidence threshold must be configuration-bound and measured, not selected by the operator to force an outcome.

## Footage and annotation evidence

Fixture identifier: Open Model Zoo `people-detection.mp4`  
Source/owner: OpenVINO official test-data storage  
Source: https://storage.openvinotoolkit.org/data/test_data/videos/people-detection.mp4  
Permission and permitted use: Official demo documentation says videos from the Open Model Zoo test-data location may be used for demos; no separate retention or redistribution terms were found. **LICENSE REVIEW REQUIRED**.  
Retention/deletion condition: Not documented  
Fixture SHA-256: `18ffe8672d741e3e29c9d891d22c59d453720b086c25b35c88b393d55f92f693`  
Independent annotation file/hash: **NOT AVAILABLE**

The official clip is 768x432, 12 fps and 596 frames. It shows people in an indoor room/corridor rather than a SmartCross crossing. Independent frame annotations were not created because the footage does not establish the configured crossing polygon or all required states; entering/occupied/leaving can be observed in parts, but partly occluded and crossing-zone semantics remain unverified. Ground-truth annotations must be created independently of detector output and must never be passed to the model as detections.

## Suitability conclusion and decision choices

The candidate is technically feasible for an initial offline adapter: it loaded and ran real inference at measured CPU latency, and the observed input/output contract matched the official specification. Its published internal AP and this indoor sample are not evidence for SmartCross camera geometry, crossing scale or occlusion performance. Suitability for actual crossing footage remains **NOT MEASURED**.

Decision: **PENDING EVIDENCE**

The owner may later select exactly one:

- APPROVE FOR OFFLINE DEVELOPMENT
- REJECT
- PENDING EVIDENCE

Approval here would not approve field use, HIL, live observation, roadside integration or signal actuation.
