# API Chatbot Service - Meal plan + Chat Trợ lý ảo
import json
import os
from urllib.error import URLError, HTTPError
from urllib.parse import urlencode
from urllib.request import Request as UrlRequest, urlopen

from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from chatbot.meal_plan import generate_meal_plan
from chatbot.chat import chat_reply
from chatbot.chat_session import (
    init_chat_tables,
    create_chat_session,
    get_chat_sessions,
    get_session_messages,
    save_chat_message,
    set_session_title_if_empty,
    delete_chat_session,
)

app = FastAPI(title="Chatbot & Meal Plan Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000/api").rstrip("/")


def ensure_host_chat_permission(request: Request):
    auth_header = request.headers.get("authorization")
    room_id = request.headers.get("x-room-id")
    if not auth_header or not room_id:
        raise HTTPException(status_code=403, detail="Chỉ HOST trong room mới được dùng chatbot")

    params = urlencode({"room_id": room_id})
    url = f"{BACKEND_API_URL}/rooms/me?{params}"
    req = UrlRequest(
        url,
        headers={
            "Authorization": auth_header,
            "x-room-id": room_id,
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=5) as resp:
            raw = resp.read().decode("utf-8")
            payload = json.loads(raw or "{}")
            data = payload.get("data") if isinstance(payload, dict) else None
            role_in_room = (data or {}).get("member_role")
            if role_in_room != "host":
                raise HTTPException(status_code=403, detail="Chỉ HOST trong room mới được dùng chatbot")
    except HTTPError:
        raise HTTPException(status_code=403, detail="Bạn không có quyền chatbot trong room hiện tại")
    except (URLError, TimeoutError, ValueError):
        raise HTTPException(status_code=503, detail="Không thể kiểm tra quyền chatbot")


@app.on_event("startup")
def startup_event():
    init_chat_tables()


@app.get("/meal-plan")
def get_meal_plan(
    request: Request,
    user_id: int = Query(..., description="ID người dùng (user_id) để lấy hồ sơ sức khỏe và tạo thực đơn 7 ngày"),
):
    """
    Tạo kế hoạch thực đơn 7 ngày cá nhân hóa theo hồ sơ sức khỏe (health_profiles) của user_id.
    Trả về JSON: mealPlan (7 ngày, mỗi ngày breakfast/lunch/dinner), totalDailyCalories, benefits, warnings, recommendations.
    """
    ensure_host_chat_permission(request)
    try:
        result = generate_meal_plan(user_id)
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result.get("error"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ChatRequest(BaseModel):
    message: str
    user_id: int | None = None
    session_id: int | None = None


class SessionCreateRequest(BaseModel):
    user_id: int | None = None


@app.post("/chat/sessions")
def create_session(body: SessionCreateRequest, request: Request):
    ensure_host_chat_permission(request)
    session_id = create_chat_session(body.user_id)
    return {"session_id": session_id}


@app.get("/chat/sessions")
def list_sessions(
    request: Request,
    user_id: int | None = Query(None, description="ID người dùng để lấy danh sách phiên chat"),
):
    ensure_host_chat_permission(request)
    sessions = get_chat_sessions(user_id=user_id, limit=20)
    return {"sessions": sessions}


@app.get("/chat/sessions/{session_id}/messages")
def get_messages(
    request: Request,
    session_id: int,
    user_id: int | None = Query(None, description="ID người dùng sở hữu session"),
):
    ensure_host_chat_permission(request)
    messages = get_session_messages(session_id=session_id, user_id=user_id, limit=500)
    if not messages:
        return {"messages": []}
    return {"messages": messages}


@app.delete("/chat/sessions/{session_id}")
def delete_session(
    request: Request,
    session_id: int,
    user_id: int | None = Query(None, description="ID người dùng sở hữu session"),
):
    ensure_host_chat_permission(request)
    deleted = delete_chat_session(session_id=session_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên chat để xóa")
    return {"deleted": True, "session_id": session_id}


@app.post("/chat")
def post_chat(body: ChatRequest, request: Request):
    """Trợ lý ảo: gửi tin nhắn, nhận câu trả lời và tự lưu vào session."""
    ensure_host_chat_permission(request)
    message_text = (body.message or "").strip()
    if not message_text:
        return {"reply": "Bạn chưa nhập nội dung. Hãy gửi tin nhắn để mình hỗ trợ.", "session_id": body.session_id}

    session_id = body.session_id
    if session_id is None:
        session_id = create_chat_session(body.user_id)

    history = []
    if session_id is not None:
        rows = get_session_messages(session_id=session_id, user_id=body.user_id, limit=50)
        history = [{"role": r.get("role"), "content": r.get("content")} for r in rows]

    reply = chat_reply(
        user_message=message_text,
        history=history,
        user_id=body.user_id,
    )

    if session_id is not None:
        save_chat_message(session_id=session_id, role="user", content=message_text)
        set_session_title_if_empty(session_id=session_id, title=message_text)
        save_chat_message(session_id=session_id, role="assistant", content=reply.strip())

    return {"reply": reply, "session_id": session_id}


@app.get("/health")
def health():
    return {"status": "ok"}
