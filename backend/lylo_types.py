"""
LYLO Security - Type Definitions
Comprehensive type definitions for the LYLO security system
"""

from typing import (
    Dict, List, Optional, Union, Any, Callable, TypeVar, Generic,
    Protocol, runtime_checkable, Literal, NewType, TypedDict
)
from datetime import datetime
from enum import Enum
import uuid

# ═══════════════════════════════════════════════════════════════════════════════
#                               BASIC TYPES
# ═══════════════════════════════════════════════════════════════════════════════

# User and session types
UserID = NewType('UserID', str)
SessionID = NewType('SessionID', str)
APIKey = NewType('APIKey', str)

# AI and embedding types
EmbeddingVector = List[float]
PromptText = NewType('PromptText', str)
ResponseText = NewType('ResponseText', str)

# Security and vault types
EncryptionKey = NewType('EncryptionKey', bytes)
VaultData = Dict[str, Any]
SecurityLevel = Literal["low", "medium", "high", "critical"]

# Memory and context types
MemoryPin = NewType('MemoryPin', str)
ContextWindow = NewType('ContextWindow', str)

# ═══════════════════════════════════════════════════════════════════════════════
#                                  ENUMS
# ═══════════════════════════════════════════════════════════════════════════════

class PersonaType(Enum):
    """Available persona types in the LYLO council."""
    GUARDIAN = "guardian"
    BESTIE = "bestie"
    MECHANIC = "mechanic"
    GUIDE = "guide"
    BUILDER = "builder"

class ToneType(Enum):
    """Available tone types for personas."""
    GHOST = "ghost"
    BESTIE = "bestie"
    ARCHITECT = "architect"

class VaultType(Enum):
    """Types of secure vaults available."""
    MEDICAL = "medical"
    TACTICAL = "tactical"
    FINANCIAL = "financial"
    PERSONAL = "personal"
    TECHNICAL = "technical"

class RecordType(Enum):
    """Types of records stored in the system."""
    PINNED_EVENT = "pinned_event"
    CONVERSATION = "conversation"
    VAULT_ENTRY = "vault_entry"
    SECURITY_LOG = "security_log"
    SYSTEM_EVENT = "system_event"

class SecurityThreatLevel(Enum):
    """Security threat levels."""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

# ═══════════════════════════════════════════════════════════════════════════════
#                              TYPED DICTIONARIES
# ═══════════════════════════════════════════════════════════════════════════════

class PersonaConfig(TypedDict):
    """Configuration for a LYLO persona."""
    id: PersonaType
    tone: ToneType
    briefing: str
    execution_command: str
    security_level: SecurityLevel

class MemoryMetadata(TypedDict):
    """Metadata for memory storage."""
    user_id: UserID
    content: str
    record_type: RecordType
    timestamp: str
    importance: float
    tags: List[str]

class VaultEntry(TypedDict):
    """Structure for vault entries."""
    id: str
    user_id: UserID
    vault_type: VaultType
    encrypted_data: bytes
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

class SecurityEvent(TypedDict):
    """Structure for security events."""
    id: str
    user_id: UserID
    event_type: str
    threat_level: SecurityThreatLevel
    description: str
    metadata: Dict[str, Any]
    timestamp: datetime

class AIResponse(TypedDict):
    """Structure for AI model responses."""
    content: ResponseText
    model: str
    tokens_used: int
    processing_time: float
    confidence: Optional[float]

# ═══════════════════════════════════════════════════════════════════════════════
#                              PROTOCOLS
# ═══════════════════════════════════════════════════════════════════════════════

@runtime_checkable
class VectorIndex(Protocol):
    """Protocol for vector database indexes."""

    def query(
        self,
        vector: EmbeddingVector,
        filter: Dict[str, Any],
        top_k: int = 10,
        include_metadata: bool = True
    ) -> Any:
        """Query the vector index."""
        ...

    def upsert(
        self,
        vectors: List[tuple]
    ) -> Any:
        """Upsert vectors to the index."""
        ...

@runtime_checkable
class AIClient(Protocol):
    """Protocol for AI service clients."""

    def complete(
        self,
        prompt: PromptText,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None
    ) -> AIResponse:
        """Generate AI completion."""
        ...

    def embed(
        self,
        text: str,
        model: Optional[str] = None
    ) -> EmbeddingVector:
        """Generate text embedding."""
        ...

@runtime_checkable
class VaultService(Protocol):
    """Protocol for vault services."""

    def encrypt_data(
        self,
        data: VaultData,
        key: EncryptionKey
    ) -> bytes:
        """Encrypt vault data."""
        ...

    def decrypt_data(
        self,
        encrypted_data: bytes,
        key: EncryptionKey
    ) -> VaultData:
        """Decrypt vault data."""
        ...

    def store_entry(
        self,
        entry: VaultEntry
    ) -> bool:
        """Store vault entry."""
        ...

# ═══════════════════════════════════════════════════════════════════════════════
#                              GENERIC TYPES
# ═══════════════════════════════════════════════════════════════════════════════

T = TypeVar('T')
K = TypeVar('K')
V = TypeVar('V')

class Result(Generic[T]):
    """Generic result type for error handling."""

    def __init__(self, value: Optional[T] = None, error: Optional[str] = None):
        self.value = value
        self.error = error
        self.is_success = error is None

    @classmethod
    def success(cls, value: T) -> 'Result[T]':
        """Create successful result."""
        return cls(value=value)

    @classmethod
    def failure(cls, error: str) -> 'Result[T]':
        """Create failed result."""
        return cls(error=error)

class CacheEntry(Generic[T]):
    """Generic cache entry with TTL."""

    def __init__(self, value: T, expires_at: datetime):
        self.value = value
        self.expires_at = expires_at

    def is_expired(self) -> bool:
        """Check if cache entry is expired."""
        return datetime.now() > self.expires_at

# ═══════════════════════════════════════════════════════════════════════════════
#                              FUNCTION TYPES
# ═══════════════════════════════════════════════════════════════════════════════

# Callback types
SuccessCallback = Callable[[T], None]
ErrorCallback = Callable[[Exception], None]
ProgressCallback = Callable[[float], None]

# Validation types
Validator = Callable[[Any], bool]
Transformer = Callable[[T], T]

# Security types
AuthValidator = Callable[[UserID, APIKey], bool]
PermissionChecker = Callable[[UserID, str], bool]

# ═══════════════════════════════════════════════════════════════════════════════
#                              UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def generate_id() -> str:
    """Generate a unique ID."""
    return str(uuid.uuid4())

def validate_user_id(user_id: str) -> UserID:
    """Validate and return UserID."""
    if not user_id or not isinstance(user_id, str):
        raise ValueError("Invalid user ID")
    return UserID(user_id.strip())

def validate_persona_type(persona: str) -> PersonaType:
    """Validate and return PersonaType."""
    try:
        return PersonaType(persona.lower())
    except ValueError:
        raise ValueError(f"Invalid persona type: {persona}")

def validate_security_level(level: str) -> SecurityLevel:
    """Validate and return security level."""
    valid_levels = ["low", "medium", "high", "critical"]
    if level.lower() not in valid_levels:
        raise ValueError(f"Invalid security level: {level}")
    return level.lower()  # type: ignore

# ═══════════════════════════════════════════════════════════════════════════════
#                              TYPE GUARDS
# ═══════════════════════════════════════════════════════════════════════════════

def is_valid_embedding(vector: Any) -> bool:
    """Check if vector is a valid embedding."""
    return (
        isinstance(vector, list) and
        len(vector) > 0 and
        all(isinstance(x, (int, float)) for x in vector)
    )

def is_valid_metadata(metadata: Any) -> bool:
    """Check if metadata is valid."""
    return isinstance(metadata, dict) and all(
        isinstance(k, str) for k in metadata.keys()
    )

def is_vault_entry(data: Any) -> bool:
    """Check if data is a valid vault entry."""
    required_fields = ['id', 'user_id', 'vault_type', 'encrypted_data']
    return (
        isinstance(data, dict) and
        all(field in data for field in required_fields)
    )