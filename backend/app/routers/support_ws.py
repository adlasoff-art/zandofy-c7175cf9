"""WebSocket — chat support temps réel (remplace Supabase Realtime)."""
import json
from typing import Dict, Set
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.profile import UserRole, AppRole
from app.models.support import SupportTicket, SupportMessage
from app.services.security import decode_access_token

# In-memory room management (un seul process). En production : Redis PubSub.
active_connections: Dict[str, Set[WebSocket]] = {}


async def broadcast_message(ticket_id: UUID, message: SupportMessage) -> None:
    """Envoie un nouveau message à tous les clients connectés au ticket."""
    room = str(ticket_id)
    if room not in active_connections:
        return
    payload = json.dumps({
        "type": "new_message",
        "data": {
            "id": str(message.id),
            "ticket_id": str(message.ticket_id),
            "sender_id": str(message.sender_id),
            "content": message.content,
            "attachment_url": message.attachment_url,
            "is_staff": message.is_staff,
            "created_at": message.created_at.isoformat(),
        },
    })
    dead: list[WebSocket] = []
    for ws in active_connections[room]:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        active_connections[room].discard(ws)
    if not active_connections[room]:
        del active_connections[room]


router = APIRouter()


async def _check_ticket_access(session: AsyncSession, ticket_id: UUID, user_id: UUID) -> bool:
    """Vérifie que l'utilisateur a accès au ticket (propriétaire ou staff)."""
    result = await session.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        return False
    if ticket.user_id == user_id:
        return True
    role_result = await session.execute(
        select(UserRole).where(
            UserRole.user_id == user_id,
            UserRole.role.in_([AppRole.admin, AppRole.manager]),
        )
    )
    return role_result.scalar_one_or_none() is not None


@router.websocket("/tickets/{ticket_id}/ws")
async def support_chat_ws(websocket: WebSocket, ticket_id: UUID) -> None:
    """
    WebSocket chat support.
    Premier message attendu : { "type": "auth", "token": "eyJ..." }.
    Ensuite le serveur broadcast les nouveaux messages aux clients connectés.
    """
    await websocket.accept()

    try:
        auth_msg = await websocket.receive_text()
        auth_data = json.loads(auth_msg)
        if auth_data.get("type") != "auth" or not auth_data.get("token"):
            await websocket.close(code=4001, reason="Auth required")
            return
    except Exception:
        await websocket.close(code=4001, reason="Auth failed")
        return

    payload = decode_access_token(auth_data["token"])
    if not payload or "sub" not in payload:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = UUID(payload["sub"])

    async with AsyncSessionLocal() as session:
        if not await _check_ticket_access(session, ticket_id, user_id):
            await websocket.close(code=4003, reason="Forbidden")
            return

    room = str(ticket_id)
    if room not in active_connections:
        active_connections[room] = set()
    active_connections[room].add(websocket)

    try:
        while True:
            await websocket.receive_text()
            # Messages entrants gérés par REST ; on garde la connexion ouverte
    except WebSocketDisconnect:
        active_connections[room].discard(websocket)
        if not active_connections[room]:
            del active_connections[room]
