"""JWT (access 15min, refresh 7j) et hachage mot de passe — spec Zandofy."""
from datetime import datetime, timezone, timedelta
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TYPE_ACCESS = "access"
TYPE_REFRESH = "refresh"
TYPE_IMPERSONATION_ACCESS = "impersonation_access"
TYPE_IMPERSONATION_REFRESH = "impersonation_refresh"
TYPE_RESET_PASSWORD = "reset_password"
TYPE_VERIFY_EMAIL = "verify_email"


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str | UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_expire_minutes)
    return jwt.encode(
        {"sub": str(subject), "exp": expire, "type": TYPE_ACCESS},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(subject: str | UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expire_days)
    return jwt.encode(
        {"sub": str(subject), "exp": expire, "type": TYPE_REFRESH},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None


def decode_access_token(token: str) -> dict | None:
    """JWT backend (type=access) ou Supabase (si supabase_jwt_secret configuré)."""
    payload = decode_token(token)
    if payload and payload.get("type") in (TYPE_ACCESS, TYPE_IMPERSONATION_ACCESS):
        return payload
    if settings.supabase_jwt_secret:
        try:
            supabase_payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_aud": True},
            )
            if supabase_payload and "sub" in supabase_payload:
                return {"sub": supabase_payload["sub"]}
        except JWTError:
            try:
                supabase_payload = jwt.decode(
                    token, settings.supabase_jwt_secret, algorithms=["HS256"]
                )
                if supabase_payload and "sub" in supabase_payload:
                    return {"sub": supabase_payload["sub"]}
            except JWTError:
                pass
    return None


def decode_refresh_token(token: str) -> dict | None:
    payload = decode_token(token)
    if payload and payload.get("type") == TYPE_REFRESH:
        return payload
    return None


def create_reset_password_token(subject: str | UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode(
        {"sub": str(subject), "exp": expire, "type": TYPE_RESET_PASSWORD},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_reset_password_token(token: str) -> dict | None:
    payload = decode_token(token)
    if payload and payload.get("type") == TYPE_RESET_PASSWORD:
        return payload
    return None


def create_verify_email_token(subject: str | UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    return jwt.encode(
        {"sub": str(subject), "exp": expire, "type": TYPE_VERIFY_EMAIL},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_verify_email_token(token: str) -> dict | None:
    payload = decode_token(token)
    if payload and payload.get("type") == TYPE_VERIFY_EMAIL:
        return payload
    return None


def create_impersonation_access_token(
    subject: str | UUID,
    email: str | None,
    roles: list[str],
    impersonated_by: str | UUID,
) -> str:
    """JWT d'accès pour une session d'impersonation (claim impersonated_by pour la bannière)."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_expire_minutes)
    return jwt.encode(
        {
            "sub": str(subject),
            "exp": expire,
            "type": TYPE_IMPERSONATION_ACCESS,
            "email": email,
            "roles": roles,
            "impersonated_by": str(impersonated_by),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_impersonation_refresh_token(subject: str | UUID, impersonated_by: str | UUID) -> str:
    """Refresh token pour prolonger une session d'impersonation."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expire_days)
    return jwt.encode(
        {
            "sub": str(subject),
            "exp": expire,
            "type": TYPE_IMPERSONATION_REFRESH,
            "impersonated_by": str(impersonated_by),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
