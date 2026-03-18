#!/usr/bin/env python3
"""
Chạy Camera Service API (stream MJPEG + fall detection).
Tự động chạy từ thư mục AI_Service để relative imports trong video.py hoạt động.

Cách dùng (từ bất kỳ đâu, miễn là trong Camera_Service hoặc AI_Service):
  python run_stream_api.py
"""
import os
import sys
import subprocess

def main():
    # Thư mục AI_Service (cha của Camera_Service)
    this_dir = os.path.dirname(os.path.abspath(__file__))
    ai_service_dir = os.path.dirname(this_dir)
    os.chdir(ai_service_dir)
    # Chạy như module để package Camera_Service được nhận đúng
    code = subprocess.run(
        [sys.executable, "-m", "Camera_Service.api.main"],
        cwd=ai_service_dir,
    ).returncode
    sys.exit(code or 0)

if __name__ == "__main__":
    main()
