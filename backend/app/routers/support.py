"""Support client — tickets et messages (REST)."""
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, status, UploadFile
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user, get_current_user_roles
from app.models.profile import Profile
from app.models.support import SupportTicket, SupportMessage
from app.models.notification import Notification
from app.schemas.support import (
    CreateTicketRequest,
    UpdateTicketRequest,
    TicketResponse,
    TicketListResponse,
    MessageResponse,
    MessageListResponse,
)
from app.services.file_service import save_chat_attachment
from app.routers.support_ws import broadcast_message

router = APIRouter(prefix="/support", tags=["support"])


def _is_staff(roles: list[str]) -> bool:
    return "admin" in roles or "manager" in roles


def _ticket_to_response(t: SupportTicket, last_preview: Optional[str] = None, unread: int = 0) -> TicketResponse:
    return TicketResponse(
        id=t.id,
        user_id=t.user_id,
        subject=t.subject,
        status=t.status,
        priority=t.priority,
        category=t.category,
        order_id=t.order_id,
        assigned_to=t.assigned_to,
        created_at=t.created_at,
        updated_at=t.updated_at,
        last_message_preview=last_preview,
        unread_count=unread,
    )


@router.post("/tickets", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    body: CreateTicketRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Créer un ticket de support."""
    ticket = SupportTicket(
        user_id=current_user.id,
        subject=body.subject,
        category=body.category,
        priority=body.priority,
        order_id=body.order_id,
    )
    db.add(ticket)
    await db.flush()

    if body.initial_message:
        msg = SupportMessage(
            ticket_id=ticket.id,
            sender_id=current_user.id,
            content=body.initial_message,
            is_staff=False,
        )
        db.add(msg)

    await db.flush()
    await db.refresh(ticket)
    return _ticket_to_response(ticket)


@router.get("/tickets", response_model=TicketListResponse)
async def list_tickets(
    current_user: Annotated[Profile, Depends(get_current_user)],
    roles: Annotated[list[str], Depends(get_current_user_roles)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: Optional[str] = None,
    category: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """Liste paginée des tickets. User : ses tickets ; Admin/Manager : tous."""
    is_staff = _is_staff(roles)
    base = select(SupportTicket)
    if not is_staff:
        base = base.where(SupportTicket.user_id == current_user.id)
    if status_filter:
        base = base.where(SupportTicket.status == status_filter)
    if category:
        base = base.where(SupportTicket.category == category)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = (
        base.options(selectinload(SupportTicket.messages))
        .order_by(SupportTicket.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    tickets = result.scalars().unique().all()

    # Optionnel : dernier message pour preview
    out: list[TicketResponse] = []
    for t in tickets:
        last_preview = None
        if t.messages:
            last_preview = t.messages[-1].content[:80] + ("..." if len(t.messages[-1].content) > 80 else "")
        out.append(_ticket_to_response(t, last_preview=last_preview))

    return TicketListResponse(tickets=out, total=total, page=page, page_size=page_size)


@router.get("/unread-count")
async def unread_support_count(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retourne le nombre de messages staff non lus pour l'utilisateur (tickets open/in_progress)."""
    ticket_stmt = (
        select(SupportTicket.id)
        .where(SupportTicket.user_id == current_user.id)
        .where(SupportTicket.status.in_(["open", "in_progress"]))
    )
    ticket_result = await db.execute(ticket_stmt)
    ticket_ids = [r[0] for r in ticket_result.all()]
    if not ticket_ids:
        return {"count": 0}

    count_stmt = (
        select(func.count(SupportMessage.id))
        .where(SupportMessage.ticket_id.in_(ticket_ids))
        .where(SupportMessage.is_staff.is_(True))
    )
    total = (await db.execute(count_stmt)).scalar() or 0
    return {"count": total}


@router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: UUID,
    current_user: Annotated[Profile, Depends(get_current_user)],
    roles: Annotated[list[str], Depends(get_current_user_roles)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Détail d'un ticket."""
    result = await db.execute(
        select(SupportTicket).where(SupportTicket.id == ticket_id).options(selectinload(SupportTicket.messages))
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    is_staff = _is_staff(roles)
    if not is_staff and ticket.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    last_preview = None
    if ticket.messages:
        last_preview = ticket.messages[-1].content[:80] + ("..." if len(ticket.messages[-1].content) > 80 else "")
    return _ticket_to_response(ticket, last_preview=last_preview)


@router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: UUID,
    body: UpdateTicketRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    roles: Annotated[list[str], Depends(get_current_user_roles)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Modifier statut, priorité, assignation. Admin/Manager uniquement."""
    if not _is_staff(roles):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin/Manager required")

    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if body.status is not None:
        ticket.status = body.status
    if body.priority is not None:
        ticket.priority = body.priority
    if body.assigned_to is not None:
        ticket.assigned_to = body.assigned_to

    await db.flush()
    await db.refresh(ticket)
    return _ticket_to_response(ticket)


@router.post("/tickets/{ticket_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    ticket_id: UUID,
    current_user: Annotated[Profile, Depends(get_current_user)],
    roles: Annotated[list[str], Depends(get_current_user_roles)],
    db: Annotated[AsyncSession, Depends(get_db)],
    content: str = Form(...),
    attachment: Optional[UploadFile] = File(default=None),
):
    """Envoyer un message dans un ticket. Pièces jointes optionnelles."""
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    is_staff = _is_staff(roles)
    if not is_staff and ticket.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    attachment_url = None
    if attachment and attachment.filename:
        try:
            attachment_url = await save_chat_attachment(attachment, ticket_id)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    msg = SupportMessage(
        ticket_id=ticket_id,
        sender_id=current_user.id,
        content=content,
        is_staff=is_staff,
        attachment_url=attachment_url,
    )
    db.add(msg)
    await db.flush()

    if is_staff and ticket.status == "open":
        ticket.status = "in_progress"
        await db.flush()

    await db.refresh(msg)

    if is_staff:
        notif = Notification(
            user_id=ticket.user_id,
            type="support",
            title="Réponse du support",
            message=content[:80] + ("..." if len(content) > 80 else ""),
            link="/dashboard",
        )
        db.add(notif)

    await db.flush()
    await broadcast_message(ticket_id, msg)

    return msg


@router.get("/tickets/{ticket_id}/messages", response_model=MessageListResponse)
async def list_messages(
    ticket_id: UUID,
    current_user: Annotated[Profile, Depends(get_current_user)],
    roles: Annotated[list[str], Depends(get_current_user_roles)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Historique des messages d'un ticket."""
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    is_staff = _is_staff(roles)
    if not is_staff and ticket.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    msg_result = await db.execute(
        select(SupportMessage)
        .where(SupportMessage.ticket_id == ticket_id)
        .order_by(SupportMessage.created_at.asc())
    )
    messages = msg_result.scalars().all()
    return MessageListResponse(messages=messages, total=len(messages))
