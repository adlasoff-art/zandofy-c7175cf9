from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class IdSchema(BaseSchema):
    id: UUID


class TimestampSchema(BaseSchema):
    created_at: datetime | None = None
    updated_at: datetime | None = None
