# API Chatbot Service - Meal plan + Chat Trợ lý ảo
from fastapi import FastAPI, Query, HTTPException
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


@app.on_event("startup")
def startup_event():
    init_chat_tables()


@app.get("/meal-plan")
def get_meal_plan(user_id: int = Query(..., description="ID người dùng (user_id) để lấy hồ sơ sức khỏe và tạo thực đơn 7 ngày")):
    """
    Tạo kế hoạch thực đơn 7 ngày cá nhân hóa theo hồ sơ sức khỏe (health_profiles) của user_id.
    Trả về JSON: mealPlan (7 ngày, mỗi ngày breakfast/lunch/dinner), totalDailyCalories, benefits, warnings, recommendations.
    """
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
def create_session(body: SessionCreateRequest):
    session_id = create_chat_session(body.user_id)
    return {"session_id": session_id}


@app.get("/chat/sessions")
def list_sessions(user_id: int | None = Query(None, description="ID người dùng để lấy danh sách phiên chat")):
    sessions = get_chat_sessions(user_id=user_id, limit=20)
    return {"sessions": sessions}


@app.get("/chat/sessions/{session_id}/messages")
def get_messages(session_id: int, user_id: int | None = Query(None, description="ID người dùng sở hữu session")):
    messages = get_session_messages(session_id=session_id, user_id=user_id, limit=500)
    if not messages:
        return {"messages": []}
    return {"messages": messages}


@app.delete("/chat/sessions/{session_id}")
def delete_session(session_id: int, user_id: int | None = Query(None, description="ID người dùng sở hữu session")):
    deleted = delete_chat_session(session_id=session_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên chat để xóa")
    return {"deleted": True, "session_id": session_id}


@app.post("/chat")
def post_chat(body: ChatRequest):
    """Trợ lý ảo: gửi tin nhắn, nhận câu trả lời và tự lưu vào session."""
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
