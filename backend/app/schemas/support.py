"""Schémas Pydantic — support client et recherche visuelle."""
from datetime import datetime
from uuid import UUID
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ─── Support Tickets ───

class CreateTicketRequest(BaseModel):
    subject: str = Field(..., min_length=3, max_length=255)
    category: str = Field(default="other")
    priority: str = Field(default="medium")
    order_id: Optional[UUID] = None
    initial_message: Optional[str] = Field(
        None,
        min_length=1,
        max_length=5000,
        description="Premier message à la création du ticket",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "subject": "Problème avec ma commande ZND-20250601-ABC",
                "category": "order",
                "priority": "high",
                "initial_message": "Je n'ai toujours pas reçu ma commande après 15 jours.",
            }
        }
    )


class UpdateTicketRequest(BaseModel):
    status: Optional[str] = None  # open, in_progress, resolved, closed
    priority: Optional[str] = None  # low, medium, high, urgent
    assigned_to: Optional[UUID] = None


class TicketResponse(BaseModel):
    id: UUID
    user_id: UUID
    subject: str
    status: str
    priority: str
    category: str
    order_id: Optional[UUID] = None
    assigned_to: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    last_message_preview: Optional[str] = None
    unread_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class TicketListResponse(BaseModel):
    tickets: list[TicketResponse]
    total: int
    page: int
    page_size: int


# ─── Support Messages ───

class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


class MessageResponse(BaseModel):
    id: UUID
    ticket_id: UUID
    sender_id: UUID
    content: str
    attachment_url: Optional[str] = None
    is_staff: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MessageListResponse(BaseModel):
    messages: list[MessageResponse]
    total: int


# ─── Visual Search ───

class VisualSearchRequest(BaseModel):
    image_base64: str = Field(
        ...,
        description="Image en base64 (data URI ou base64 brut)",
    )


class ExtractedKeywords(BaseModel):
    keywords_fr: list[str] = Field(
        default_factory=list,
        description="5-8 mots-clés e-commerce en français",
    )
    keywords_en: list[str] = Field(
        default_factory=list,
        description="5-8 mots-clés e-commerce en anglais",
    )
    product_type: str = Field(
        ...,
        description="Type de produit principal en français",
    )
    color: Optional[str] = Field(
        None,
        description="Couleur principale en français",
    )


class VisualSearchProductResult(BaseModel):
    id: UUID
    name: str
    name_fr: str
    price: float
    currency: str
    description: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    store_id: Optional[UUID] = None
    image: str  # URL première image ou placeholder


class VisualSearchResponse(BaseModel):
    keywords: ExtractedKeywords
    products: list[VisualSearchProductResult]
