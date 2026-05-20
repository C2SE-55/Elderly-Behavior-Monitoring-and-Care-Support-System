<div id="top">

<!-- HEADER STYLE: CLASSIC -->
<div align="center">


# ELDERLY BEHAVIOR MONITORING AND CARE SUPPORT SYSTEM

<em>Empowering Elderly Safety Through Intelligent Care Monitoring</em>

<!-- BADGES -->
<img src="https://img.shields.io/github/last-commit/C2SE-55/Elderly-Behavior-Monitoring-and-Care-Support-System?style=flat&logo=git&logoColor=white&color=0080ff" alt="last-commit">
<img src="https://img.shields.io/github/languages/top/C2SE-55/Elderly-Behavior-Monitoring-and-Care-Support-System?style=flat&color=0080ff" alt="repo-top-language">
<img src="https://img.shields.io/github/languages/count/C2SE-55/Elderly-Behavior-Monitoring-and-Care-Support-System?style=flat&color=0080ff" alt="repo-language-count">

<em>Built with the tools and technologies:</em>

<img src="https://img.shields.io/badge/Express-000000.svg?style=flat&logo=Express&logoColor=white" alt="Express">
<img src="https://img.shields.io/badge/JSON-000000.svg?style=flat&logo=JSON&logoColor=white" alt="JSON">
<img src="https://img.shields.io/badge/Socket.io-010101.svg?style=flat&logo=socketdotio&logoColor=white" alt="Socket.io">
<img src="https://img.shields.io/badge/npm-CB3837.svg?style=flat&logo=npm&logoColor=white" alt="npm">
<img src="https://img.shields.io/badge/.ENV-ECD53F.svg?style=flat&logo=dotenv&logoColor=black" alt=".ENV">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat&logo=JavaScript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/Nodemon-76D04B.svg?style=flat&logo=Nodemon&logoColor=white" alt="Nodemon">
<img src="https://img.shields.io/badge/FastAPI-009688.svg?style=flat&logo=FastAPI&logoColor=white" alt="FastAPI">
<img src="https://img.shields.io/badge/React-61DAFB.svg?style=flat&logo=React&logoColor=black" alt="React">
<br>
<img src="https://img.shields.io/badge/XML-005FAD.svg?style=flat&logo=XML&logoColor=white" alt="XML">
<img src="https://img.shields.io/badge/Python-3776AB.svg?style=flat&logo=Python&logoColor=white" alt="Python">
<img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat&logo=TypeScript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/C-A8B9CC.svg?style=flat&logo=C&logoColor=black" alt="C">
<img src="https://img.shields.io/badge/bat-31369E.svg?style=flat&logo=bat&logoColor=white" alt="bat">
<img src="https://img.shields.io/badge/Expo-000020.svg?style=flat&logo=Expo&logoColor=white" alt="Expo">
<img src="https://img.shields.io/badge/ESLint-4B32C3.svg?style=flat&logo=ESLint&logoColor=white" alt="ESLint">
<img src="https://img.shields.io/badge/pandas-150458.svg?style=flat&logo=pandas&logoColor=white" alt="pandas">
<img src="https://img.shields.io/badge/Axios-5A29E4.svg?style=flat&logo=Axios&logoColor=white" alt="Axios">

</div>
<br>

---

# Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the System](#running-the-system)
- [Tesseract OCR Setup](#tesseract-ocr-setup)
- [Testing](#testing)

---

# Overview

The **Elderly Behavior Monitoring and Care Support System** is an AI-powered healthcare monitoring platform designed to improve elderly safety, healthcare support, and caregiver communication.

The system integrates:

- Real-time camera monitoring
- Human pose estimation
- Fall detection
- AI medicine recognition
- Automatic prescription support
- Chatbot communication
- Real-time notifications

This project aims to support families and caregivers by providing continuous monitoring and intelligent healthcare assistance for elderly people.

---

# Features

## AI Monitoring

- Real-time human activity monitoring
- Multi-camera support
- Human pose estimation
- Fall detection system
- Unsafe behavior detection

## Healthcare Support

- Medicine recognition from images
- OCR-based prescription scanning
- Automatic prescription assistance
- AI healthcare recommendation support

## Communication System

- Real-time notifications
- Chat system for caregivers and users
- Emergency alert support

## System Features

- Modular architecture
- Real-time video streaming
- RESTful APIs
- Cross-platform mobile application
- Scalable microservice structure

---

# System Architecture

The project consists of multiple services:

| Service | Description |
|---|---|
| Frontend | React Native mobile application |
| Backend | Node.js + Express server |
| Camera Service | AI video processing and monitoring |
| Chatbot Service | AI chatbot communication |
| Automatic Prescription Service | OCR and medicine recognition |

---

# Prerequisites

Before running the project, install:

## Required Software

- Python 3.10+
- Node.js
- npm
- Expo CLI
- Git
- Tesseract OCR

## Recommended Environment

- Windows 10/11
- Webcam or video source
- GPU support recommended for AI processing

---

# Installation

## Clone Repository

```bash
git clone https://github.com/C2SE-55/Elderly-Behavior-Monitoring-and-Care-Support-System

cd Elderly-Behavior-Monitoring-and-Care-Support-System
```

---

## Install Frontend Dependencies

```bash
cd Frontend

npm install
```

---

## Install Backend Dependencies

```bash
cd Backend

npm install
```

---

## Install AI Service Dependencies

```bash
cd AI_Service

pip install -r Chatbot_Service/requirements.txt

pip install -r Camera_Service/requirements.txt

pip install -r automatic_prescription_Service/requirements.txt
```

---

# Running the System

## Camera Service 1 (Video File)

```powershell
cd "D:\NCKH Capstone 2\EBMS\AI_Service"

py -3.10 -m venv venv

.\venv\Scripts\activate

$env:CAMERA_ID = "1"
$env:PORT = "9001"
$env:BACKEND_URL = "http://localhost:5000"

Remove-Item Env:USE_WEBCAM -ErrorAction SilentlyContinue

$env:VIDEO_SOURCE = "D:\NCKH Capstone 2\EBMS\Frontend\assets\videos\video3.mp4"

$env:VIDEO_SCALE = "0.22"
$env:VIDEO_SKIP_FRAMES = "4"
$env:VIDEO_MAX_FPS = "10"
$env:STREAM_UPDATE_EVERY_N_FRAMES = "2"

.\venv\Scripts\python.exe -m Camera_Service.api.main
```

---

## Camera Service 2 (Webcam)

```powershell
cd "D:\NCKH Capstone 2\EBMS\AI_Service"

py -3.10 -m venv venv

.\venv\Scripts\activate

$env:CAMERA_ID = "2"
$env:PORT = "9002"
$env:BACKEND_URL = "http://localhost:5000"

$env:USE_WEBCAM = "1"
$env:VIDEO_SOURCE = "0"

$env:VIDEO_SCALE = "0.52"
$env:VIDEO_SKIP_FRAMES = "1"
$env:VIDEO_MAX_FPS = "12"

.\venv\Scripts\python.exe -m Camera_Service.api.main
```

---

## Chatbot Service

```powershell
cd AI_Service

cd Chatbot_Service

uvicorn api.main:app --host 0.0.0.0 --port 8000
```

---

## Backend Server

```powershell
cd Backend

node server.js
```

---

## Frontend Application

```powershell
cd Frontend

npx expo start
```

---

## Automatic Prescription Service

```powershell
cd ai_service

cd automatic_prescription_Service

py -3.10 -m venv venv

venv\Scripts\activate

python -m uvicorn api.main:app --host 0.0.0.0 --port 6000 --reload
```

---

# Tesseract OCR Setup

The system uses **Tesseract OCR** for medicine image scanning and prescription text recognition.

---

## Install Tesseract OCR

### Windows

Download Tesseract OCR:

```text
https://github.com/UB-Mannheim/tesseract/wiki
```

Install Tesseract and remember the installation path.

Example:

```text
C:\Program Files\Tesseract-OCR
```

---

## Add Tesseract to Environment Variables

Add the following path to the Windows `Path` environment variable:

```text
C:\Program Files\Tesseract-OCR
```

---

## Verify Installation

```powershell
tesseract --version
```

---

## Install OCR Dependencies

```powershell
pip install pytesseract pillow opencv-python
```

---

## Example Python Configuration

```python
import pytesseract

pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)
```

---

# Testing

## Frontend / Backend

```bash
npm test
```

## Python Services

```bash
pytest
```

---

# Contributors

- C2SE-55 Team
- Capstone Project Researchers
- AI Healthcare Monitoring Developers

---

<div align="right">

[⬆ Return to Top](#top)

</div>
