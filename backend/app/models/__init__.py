"""Modèles SQLAlchemy — spec Zandofy (34+ tables)."""
from app.database import Base

# Import order: store before profile (UserRole has FK to stores)
from app.models.store import Store, StoreFollower, StoreReview
from app.models.profile import Profile, UserRole, AppRole
from app.models.category import Category, CategorySurcharge
from app.models.product import (
    Product,
    ProductImage,
    ProductColor,
    ProductSize,
    ProductPricingTier,
)
from app.models.order import Order, OrderItem, OrderStatusHistory, CartItem
from app.models.payment import PaymentTransaction
from app.models.shipping import (
    LogisticZone,
    ShippingZone,
    City,
    ShippingRoute,
    ShippingDefault,
    Shipment,
    Delivery,
    RiderLocation,
    SavedAddress,
)
from app.models.review import Review
from app.models.return_dispute import ReturnRequest, Dispute, DisputeMessage
from app.models.conversation import Conversation, Message
from app.models.notification import Notification, PushSubscription
from app.models.support import SupportTicket, SupportMessage
from app.models.loyalty import (
    ZandoPoints,
    PointTransaction,
    Referral,
    GiftCard,
    AffiliateTier,
    CustomerTier,
)
from app.models.vendor import (
    VendorWallet,
    VendorTransaction,
    WithdrawalRequest,
    VendorSubscription,
    VendorApplication,
    VendorDocument,
)
from app.models.cms import (
    CmsBanner,
    CmsHomepageSection,
    CmsMenuItem,
    CmsPage,
    CmsPopup,
)
from app.models.misc import (
    Coupon,
    ExchangeRate,
    PlatformSetting,
    AdminAuditLog,
    BadgeRequest,
    CancellationRequest,
)

__all__ = [
    "Base",
    "Profile",
    "UserRole",
    "AppRole",
    "Store",
    "StoreFollower",
    "StoreReview",
    "Category",
    "CategorySurcharge",
    "Product",
    "ProductImage",
    "ProductColor",
    "ProductSize",
    "ProductPricingTier",
    "Order",
    "OrderItem",
    "OrderStatusHistory",
    "CartItem",
    "PaymentTransaction",
    "LogisticZone",
    "ShippingZone",
    "City",
    "ShippingRoute",
    "ShippingDefault",
    "Shipment",
    "Delivery",
    "RiderLocation",
    "SavedAddress",
    "Review",
    "ReturnRequest",
    "Dispute",
    "DisputeMessage",
    "Conversation",
    "Message",
    "Notification",
    "PushSubscription",
    "SupportTicket",
    "SupportMessage",
    "ZandoPoints",
    "PointTransaction",
    "Referral",
    "GiftCard",
    "AffiliateTier",
    "CustomerTier",
    "VendorWallet",
    "VendorTransaction",
    "WithdrawalRequest",
    "VendorSubscription",
    "VendorApplication",
    "VendorDocument",
    "CmsBanner",
    "CmsHomepageSection",
    "CmsMenuItem",
    "CmsPage",
    "CmsPopup",
    "Coupon",
    "ExchangeRate",
    "PlatformSetting",
    "AdminAuditLog",
    "BadgeRequest",
    "CancellationRequest",
]
