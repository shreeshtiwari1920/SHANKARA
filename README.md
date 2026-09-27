# Disaster Drone AI

An AI-assisted disaster reconnaissance and search-and-rescue pipeline designed for UAV-based disaster response.

The project combines aerial human detection, disaster-scene understanding, and safe-route planning into a modular pipeline that can eventually operate in both GPS-enabled and GPS-denied environments.

---

## Overview

After a disaster, a rescue drone needs to answer three important questions:

1. **Where are the people who may need assistance?**
2. **Which areas are unsafe or inaccessible?**
3. **How can a rescue team reach a detected person safely?**

This project explores a computer-vision and path-planning pipeline for answering these questions from UAV imagery.

### System Pipeline

```text
                 UAV / Drone Camera
                        │
                        ▼
              ┌───────────────────┐
              │ Human Detection   │
              │      YOLO          │
              └─────────┬─────────┘
                        │
                        ▼
               Detected Person
                 Image Coordinates
                        │
                        ▼
              Geolocation Layer
           GPS / Camera Projection
                        │
                        ▼
              ┌───────────────────┐
              │ Disaster Scene    │
              │ Understanding     │
              │  Segmentation     │
              └─────────┬─────────┘
                        │
                        ▼
                 Hazard / No-Go
                     Areas
                        │
                        ▼
              ┌───────────────────┐
              │  Path Planning    │
              │      A*           │
              └─────────┬─────────┘
                        │
                        ▼
                Safe Route /
                  Waypoints
```

---

## Current Prototype

The current repository contains working components for:

* UAV human detection using YOLO
* Disaster-scene semantic segmentation experiments
* Dataset preprocessing and visualization
* Grid-based safe-path planning
* Geographic path-planning experiments
* Mac webcam-based real-time person detection

The system is being developed as a modular research prototype rather than a single monolithic application.

---

## Human Detection

The primary person-detection baseline uses **YOLO11n** trained on the **Search And Rescue Dataset (SARD)**.

SARD contains aerial imagery specifically designed for search-and-rescue person detection, including different human poses and natural environments.

### Detection Pipeline

```text
UAV Image / Video
       │
       ▼
YOLO11n
       │
       ▼
Person Bounding Boxes
       │
       ▼
Target Coordinates
       │
       ▼
Geolocation / Planning
```

### Model

```text
Architecture: YOLO11n
Task: Object Detection
Class: person
Inference: PyTorch / Ultralytics
Acceleration: Apple MPS during development
```

---

## Disaster Scene Understanding

The project uses post-disaster UAV datasets to investigate semantic segmentation of:

* water
* buildings
* damaged buildings
* roads
* blocked roads
* vehicles
* vegetation
* pools

### RescueNet

[RescueNet](https://github.com/BinaLab/RescueNet-A-High-Resolution-Post-Disaster-UAV-Dataset-for-Semantic-Segmentation) is a high-resolution UAV dataset collected after Hurricane Michael.

It contains 4,494 images with semantic segmentation labels covering water, building damage levels, roads, vehicles, trees and pools. The dataset is released under **CC BY-NC-ND**.

### FloodNet

[**FloodNet 2021: Track 1**](https://datasetninja.com/floodnet) provides high-resolution aerial imagery for post-flood scene understanding.

It contains 2,343 images and pixel-level semantic annotations covering flooded/non-flooded buildings and roads, water, vegetation, vehicles, pools and background. The dataset is available under **CC BY-SA 4.0**.

---

## Path Planning

A simple A* planner is used to demonstrate how detected targets and unsafe areas can be converted into a route.

Conceptually:

```text
Drone Position
      │
      ▼
Target Person
      │
      +
      │
No-Go / Hazard Areas
      │
      ▼
   A* Planner
      │
      ▼
Safe Route
```

The current planner supports grid-based experimentation and a geographic representation using latitude/longitude coordinates.

Future integration will connect the planner to:

* detected human locations
* blocked roads
* flooded regions
* damaged buildings
* other detected hazards

---

## GPS and GPS-Denied Operation

The intended system supports two navigation environments.

### GPS available

```text
GPS
 ↓
Drone Position
 ↓
Detected Target Geolocation
 ↓
Path Planner
 ↓
Waypoints
```

### GPS denied

```text
Camera / IMU
     ↓
Visual Odometry / SLAM
     ↓
Local Drone Position
     ↓
Target Localization
     ↓
Local Path Planner
```

GPS-denied localization is part of the planned system architecture; the current repository focuses primarily on validating the perception and planning components.

---

## Repository Structure

```text
disaster-drone-ai/
│
├── datasets/
│   ├── raw/
│   └── processed/
│
├── models/
│
├── scripts/
│   ├── convert_floodnet.py
│   ├── visualize_floodnet.py
│   ├── convert_rescuenet.py
│   ├── visualize_rescuenet.py
│   ├── prepare_rescuenet_segmentation.py
│   ├── convert_rescuenet_masks_to_yolo.py
│   ├── visualize_sard.py
│   ├── run_person_detection.py
│   ├── live_person_detection.py
│   └── safe_path_planner.py
│
├── docs/
│
├── runs/
│
├── .gitignore
└── README.md
```

Large datasets, trained weights, experiment outputs and virtual environments are intentionally excluded from version control.

---

## Dataset Setup

The datasets are **not stored in this repository**.

Download them from their respective sources and place them under:

```text
datasets/raw/
```

### SARD — Search And Rescue Dataset

SARD is a UAV search-and-rescue dataset for human detection.

* [SARD dataset on Kaggle](https://www.kaggle.com/datasets/nikolasgegenava/sard-search-and-rescue)
* [SARD datasets on Roboflow Universe](https://universe.roboflow.com/search?q=SARD)

The dataset contains approximately 1,980 annotated aerial frames of human targets in search-and-rescue scenarios.

### RescueNet

* [Official RescueNet repository](https://github.com/BinaLab/RescueNet-A-High-Resolution-Post-Disaster-UAV-Dataset-for-Semantic-Segmentation)

RescueNet provides high-resolution post-disaster UAV imagery and pixel-level semantic segmentation annotations.

### FloodNet

* [FloodNet dataset](https://datasetninja.com/floodnet)
* [FloodNet dataset repository](https://github.c)
