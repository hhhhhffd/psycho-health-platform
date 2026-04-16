"""
WebSocket менеджер и эндпоинты для real-time уведомлений.
/api/ws/user         — пользователь слушает обновления своих эскалаций
/api/ws/psychologist — психолог/админ слушает новые запросы
"""
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select

from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

router = APIRouter()


class WSConnectionManager:
    """
    Хранит активные WebSocket соединения.
    user_connections: {user_id: [WebSocket]}
    psych_connections: [WebSocket]  — для психологов и админов
    """

    def __init__(self) -> None:
        self.user_connections: dict[int, list[WebSocket]] = {}
        self.psych_connections: list[WebSocket] = []

    async def connect_user(self, user_id: int, ws: WebSocket) -> None:
        await ws.accept()
        self.user_connections.setdefault(user_id, []).append(ws)
        logger.info("WS: user %d connected (%d active)", user_id, len(self.user_connections))

    def disconnect_user(self, user_id: int, ws: WebSocket) -> None:
        conns = self.user_connections.get(user_id, [])
        self.user_connections[user_id] = [w for w in conns if w is not ws]
        logger.info("WS: user %d disconnected", user_id)

    async def connect_psych(self, ws: WebSocket) -> None:
        await ws.accept()
        self.psych_connections.append(ws)
        logger.info("WS: psychologist connected (%d total)", len(self.psych_connections))

    def disconnect_psych(self, ws: WebSocket) -> None:
        self.psych_connections = [w for w in self.psych_connections if w is not ws]
        logger.info("WS: psychologist disconnected (%d total)", len(self.psych_connections))

    async def notify_user(self, user_id: int, data: dict) -> None:
        """Отправить JSON-уведомление конкретному пользователю (по всем его соединениям)."""
        for ws in list(self.user_connections.get(user_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                pass  # соединение уже закрыто — игнорируем

    async def notify_psychologists(self, data: dict) -> None:
        """Отправить JSON-уведомление всем подключённым психологам и админам."""
        for ws in list(self.psych_connections):
            try:
                await ws.send_json(data)
            except Exception:
                pass


# Глобальный синглтон — импортируется из ai.py для отправки уведомлений
ws_manager = WSConnectionManager()


async def _auth_ws(token: str):
    """
    Аутентификация WebSocket-соединения через токен в query-параметре.
    Возвращает объект User или None если токен невалидный/истёк.
    """
    from app.models.user import User
    from app.core.security import decode_access_token
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub", 0))
    except Exception:
        return None

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()


@router.websocket("/user")
async def ws_user_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket для пользователя.
    Подключение: ws(s)://host/api/ws/user?token=<jwt>

    Сервер отправляет при изменении эскалации:
    {"type": "escalation_update", "id": 1, "status": "responded", "reply": "текст ответа"}
    {"type": "escalation_update", "id": 1, "status": "closed", "reply": null}
    """
    user = await _auth_ws(token)
    if not user:
        await websocket.close(code=4001)
        return

    await ws_manager.connect_user(user.id, websocket)
    try:
        while True:
            # Держим соединение живым; клиент может слать ping-строки
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_user(user.id, websocket)


@router.websocket("/psychologist")
async def ws_psychologist_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket для психологов и администраторов.
    Подключение: ws(s)://host/api/ws/psychologist?token=<jwt>

    Сервер отправляет при новой эскалации:
    {"type": "new_escalation", "id": 1, "user_name": "...", "message": "...", "auto": false}
    """
    from app.models.user import UserRole
    user = await _auth_ws(token)
    if not user or user.role not in (UserRole.psychologist, UserRole.admin):
        await websocket.close(code=4003)
        return

    await ws_manager.connect_psych(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_psych(websocket)
