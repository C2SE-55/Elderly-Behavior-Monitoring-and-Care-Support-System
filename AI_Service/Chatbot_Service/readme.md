môi trường
- python -m venv .venv
- .venv\Scripts\activate (Windows) hoặc source .venv/bin/activate (Linux/Mac)

pip install -r requirements.txt

# Chạy API (meal plan theo user_id)
# Từ thư mục Chatbot_Service:
uvicorn api.main:app --host 0.0.0.0 --port 8000

# Gọi thực đơn 7 ngày (cá nhân hóa theo hồ sơ sức khỏe):
# GET http://localhost:8000/meal-plan?user_id=1

# Cấu hình .env: GROQ_API_KEY, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (cùng DB với Backend để đọc health_profiles).

