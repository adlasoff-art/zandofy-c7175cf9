"""WebSocket — connexions temps réel (notifications, statut commande)."""
import asyncio
import json
import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    """Gestionnaire de connexions WebSocket par utilisateur (profile_id)."""

    def __init__(self):
        self._connections: dict[UUID, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: UUID | None = None) -> None:
        await websocket.accept()
        if user_id:
            if user_id not in self._connections:
                self._connections[user_id] = []
            self._connections[user_id].append(websocket)
        logger.info("WebSocket connected, user_id=%s", user_id)

    def disconnect(self, websocket: WebSocket, user_id: UUID | None = None) -> None:
        if user_id and user_id in self._connections:
            self._connections[user_id] = [c for c in self._connections[user_id] if c != websocket]
            if not self._connections[user_id]:
                del self._connections[user_id]

    async def send_personal(self, user_id: UUID, payload: dict) -> None:
        if user_id not in self._connections:
            return
        text = json.dumps(payload)
        dead = []
        for ws in self._connections[user_id]:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections[user_id].remove(ws)

    async def broadcast(self, payload: dict) -> None:
        text = json.dumps(payload)
        for uid, conns in list(self._connections.items()):
            for ws in conns[:]:
                try:
                    await ws.send_text(text)
                except Exception:
                    conns.remove(ws)


manager = ConnectionManager()


def get_ws_manager() -> ConnectionManager:
    return manager


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(None, description="JWT pour associer la connexion à un utilisateur"),
):
    """Connexion WebSocket. Si token fourni, la connexion est associée au profile pour envoi ciblé."""
    user_id: UUID | None = None
    if token:
        try:
            from app.services.security import decode_access_token
            payload = decode_access_token(token)
            if payload and "sub" in payload:
                user_id = UUID(payload["sub"])
        except Exception:
            pass
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        logger.info("WebSocket disconnected, user_id=%s", user_id)
    except Exception as e:
        logger.exception("WebSocket error: %s", e)
        manager.disconnect(websocket, user_id)
