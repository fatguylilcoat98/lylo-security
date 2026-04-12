"""
LYLO Kernel v32.0 - Fixed Version
Core prompt engineering system for LYLO council architecture with proper embeddings and type safety
"""

import os
import hashlib
import time
import logging as log
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any, Union
from openai import OpenAI

# Type aliases for clarity
PersonaID = str
MemoryPin = str
EmbeddingVector = List[float]

# Initialize OpenAI client for embeddings
openai_client = OpenAI()

# ═══════════════════════════════════════════════════════════════════════════════
#                               CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

PERSONA_TONE_MAP: Dict[str, str] = {
    "guardian": "ghost",
    "bestie": "bestie",
    "mechanic": "architect",
    "guide": "architect",
    "builder": "architect"
}

PERSONA_BRIEFINGS: Dict[str, str] = {
    "guardian": """
You are the Guardian persona of the LYLO Council. Your role is to protect the user from threats,
provide security analysis, and maintain vigilant oversight of their digital and physical safety.

Key responsibilities:
- Threat assessment and mitigation
- Security protocol guidance
- Emergency response coordination
- Risk analysis and prevention

Communication style: Direct, authoritative, protective
""",

    "bestie": """
You are the Bestie persona of the LYLO Council. Your role is to provide emotional support,
friendship, and personal guidance with warmth and understanding.

Key responsibilities:
- Emotional support and counseling
- Personal relationship advice
- Mental health awareness
- Motivation and encouragement

Communication style: Warm, supportive, empathetic
""",

    "mechanic": """
You are the Mechanic persona of the LYLO Council. Your role is to provide technical assistance,
troubleshooting, and practical solutions for technology and systems.

Key responsibilities:
- Technical troubleshooting
- System optimization
- Hardware/software guidance
- Practical problem-solving

Communication style: Practical, methodical, solution-focused
""",

    "guide": """
You are the Guide persona of the LYLO Council. Your role is to provide educational guidance,
learning support, and knowledge navigation.

Key responsibilities:
- Educational assistance
- Learning path guidance
- Knowledge synthesis
- Skill development support

Communication style: Patient, informative, encouraging
""",

    "builder": """
You are the Builder persona of the LYLO Council. Your role is to help create, construct,
and develop projects, ideas, and solutions.

Key responsibilities:
- Project planning and execution
- Creative development
- Strategic planning
- Implementation guidance

Communication style: Constructive, visionary, action-oriented
"""
}

TONE_TEMPLATES: Dict[str, str] = {
    "ghost": "Operate with stealth precision. Direct, minimal words. Maximum impact.",
    "bestie": "Warm, supportive, like talking to your closest friend. Empathetic and understanding.",
    "architect": "Methodical, structured, building solutions step by step. Analytical and thorough."
}

EXECUTION_COMMANDS: Dict[str, str] = {
    "guardian": "PROTECT - Assess threats and provide security guidance",
    "bestie": "SUPPORT - Provide emotional care and personal guidance",
    "mechanic": "SOLVE - Diagnose problems and implement solutions",
    "guide": "TEACH - Educate and guide learning",
    "builder": "CREATE - Build and develop solutions"
}

# Banned phrases for safety
BANNED_PHRASES: List[str] = [
    "I cannot", "I can't", "I'm unable", "It's impossible",
    "I don't have access", "I'm not allowed", "I cannot assist",
    "As an AI", "I'm just an AI", "I'm an artificial intelligence"
]

# ═══════════════════════════════════════════════════════════════════════════════
#                               EMBEDDING UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def generate_embedding(text: str, model: str = "text-embedding-3-small") -> Optional[EmbeddingVector]:
    """
    Generate embedding vector for text using OpenAI's embedding API.

    Args:
        text: Text content to embed
        model: OpenAI embedding model to use

    Returns:
        Embedding vector or None if generation fails
    """
    try:
        if not text or not text.strip():
            log.warning("Empty text provided for embedding generation")
            return None

        response = openai_client.embeddings.create(
            model=model,
            input=text.strip()
        )

        embedding = response.data[0].embedding
        log.debug(f"Generated embedding of dimension {len(embedding)} for text: {text[:50]}...")
        return embedding

    except Exception as e:
        log.error(f"Failed to generate embedding for text '{text[:50]}...': {e}")
        return None

def create_search_embedding(user_context: str, persona_id: str) -> Optional[EmbeddingVector]:
    """
    Create an embedding optimized for searching user memories.

    Args:
        user_context: Current conversation context
        persona_id: The persona requesting memories

    Returns:
        Search-optimized embedding vector
    """
    search_text = f"conversation context for {persona_id}: {user_context}"
    return generate_embedding(search_text)

# ═══════════════════════════════════════════════════════════════════════════════
#                               MEMORY OPERATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def fetch_memory_pins(
    index: Any,
    user_id: str,
    search_context: str = "",
    persona_id: str = "guardian",
    limit: int = 3
) -> List[MemoryPin]:
    """
    Fetch relevant memory pins using semantic search.

    Args:
        index: Pinecone index instance
        user_id: User identifier for filtering
        search_context: Context to search for relevant memories
        persona_id: Persona requesting memories
        limit: Maximum number of memories to return

    Returns:
        List of relevant memory pin contents
    """
    if not index:
        log.warning("No Pinecone index provided")
        return []

    try:
        # Generate semantic search vector
        if search_context.strip():
            query_vector = create_search_embedding(search_context, persona_id)
            if not query_vector:
                log.error("Failed to generate search embedding, falling back to metadata search")
                return _fallback_metadata_search(index, user_id, limit)
        else:
            log.info("No search context provided, using metadata-only search")
            return _fallback_metadata_search(index, user_id, limit)

        # Perform semantic search
        results = index.query(
            vector=query_vector,
            filter={
                "user_id": {"$eq": user_id},
                "record_type": {"$eq": "pinned_event"},
            },
            top_k=limit,
            include_metadata=True
        )

        # Extract memory content
        memories = []
        for match in results.matches:
            if match.metadata and "content" in match.metadata:
                content = match.metadata["content"]
                memories.append(content)
                log.debug(f"Retrieved memory with score {match.score:.3f}: {content[:50]}...")

        log.info(f"Retrieved {len(memories)} relevant memories for user {user_id}")
        return memories

    except Exception as e:
        log.error(f"Error fetching memory pins for user {user_id}: {e}")
        return []

def _fallback_metadata_search(index: Any, user_id: str, limit: int) -> List[MemoryPin]:
    """
    Fallback to metadata-only search when embedding generation fails.

    Args:
        index: Pinecone index instance
        user_id: User identifier
        limit: Maximum results to return

    Returns:
        List of memory contents from metadata search
    """
    try:
        # Use dummy vector but rely on metadata filtering
        dummy_vector = [0.0] * 1536  # Standard OpenAI embedding dimension

        results = index.query(
            vector=dummy_vector,
            filter={
                "user_id": {"$eq": user_id},
                "record_type": {"$eq": "pinned_event"},
            },
            top_k=limit,
            include_metadata=True
        )

        memories = []
        for match in results.matches:
            if match.metadata and "content" in match.metadata:
                memories.append(match.metadata["content"])

        log.info(f"Fallback search retrieved {len(memories)} memories")
        return memories

    except Exception as e:
        log.error(f"Fallback memory search failed: {e}")
        return []

def upsert_memory_pin(
    index: Any,
    user_id: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Store a new memory pin with proper embedding.

    Args:
        index: Pinecone index instance
        user_id: User identifier
        content: Memory content to store
        metadata: Additional metadata to store

    Returns:
        True if successfully stored, False otherwise
    """
    if not index or not content.strip():
        return False

    try:
        # Generate embedding for the content
        embedding = generate_embedding(content)
        if not embedding:
            log.error("Failed to generate embedding for memory content")
            return False

        # Create memory ID
        memory_id = hashlib.md5(f"{user_id}_{content}_{time.time()}".encode()).hexdigest()

        # Prepare metadata
        pin_metadata = {
            "user_id": user_id,
            "content": content,
            "record_type": "pinned_event",
            "timestamp": datetime.now().isoformat(),
            **(metadata or {})
        }

        # Upsert to Pinecone
        index.upsert(vectors=[(memory_id, embedding, pin_metadata)])
        log.info(f"Successfully stored memory pin {memory_id[:8]} for user {user_id}")
        return True

    except Exception as e:
        log.error(f"Failed to upsert memory pin: {e}")
        return False

# ═══════════════════════════════════════════════════════════════════════════════
#                               PROMPT BUILDING
# ═══════════════════════════════════════════════════════════════════════════════

def build_memory_block(memory_pins: List[MemoryPin]) -> str:
    """
    Build formatted memory context block from pins.

    Args:
        memory_pins: List of memory pin contents

    Returns:
        Formatted memory block for prompt
    """
    if not memory_pins:
        return "No relevant memories found."

    memory_lines = []
    for i, pin in enumerate(memory_pins[:5], 1):  # Limit to 5 memories
        # Clean and truncate memory content
        clean_pin = pin.strip()[:200]  # Limit length
        memory_lines.append(f"• Memory {i}: {clean_pin}")

    memory_block = "\n".join(memory_lines)

    return f"""
RELEVANT USER MEMORIES:
{memory_block}

[Use these memories to provide personalized responses, but do not explicitly list them]
"""

def validate_persona_id(persona_id: str) -> str:
    """
    Validate and normalize persona ID.

    Args:
        persona_id: Persona identifier to validate

    Returns:
        Valid persona ID (defaults to 'guardian' if invalid)
    """
    persona_id = persona_id.lower().strip()
    if persona_id in PERSONA_TONE_MAP:
        return persona_id

    log.warning(f"Invalid persona_id '{persona_id}', defaulting to 'guardian'")
    return "guardian"

def build_system_prompt(
    persona_id: str,
    memory_pins: List[MemoryPin],
    user_name: Optional[str] = None
) -> str:
    """
    Build complete system prompt for the specified persona.

    Args:
        persona_id: The persona to activate
        memory_pins: Relevant user memories
        user_name: User's preferred name

    Returns:
        Complete system prompt string
    """
    # Validate inputs
    persona_id = validate_persona_id(persona_id)
    safe_user_name = (user_name or "").strip() or "there"

    # Get persona configuration
    tone_key = PERSONA_TONE_MAP[persona_id]
    tone_template = TONE_TEMPLATES[tone_key]
    persona_briefing = PERSONA_BRIEFINGS[persona_id]
    execution_command = EXECUTION_COMMANDS[persona_id]

    # Build components
    memory_block = build_memory_block(memory_pins)

    # Assemble final prompt
    system_prompt = f"""
═══════════════════════════════════════════════════════════════
                        LYLO COUNCIL ACTIVATION
═══════════════════════════════════════════════════════════════

PERSONA: {persona_id.upper()}
TONE: {tone_template}
USER: {safe_user_name}

{persona_briefing}

{memory_block}

EXECUTION: {execution_command}

HUMAN BALANCE PROTOCOL:
- Never use phrases: {', '.join(BANNED_PHRASES[:3])}...
- Provide practical solutions and guidance
- Maintain persona authenticity
- Prioritize user safety and wellbeing

[Respond as {persona_id} with {tone_key} tone, addressing {safe_user_name}]
═══════════════════════════════════════════════════════════════
"""

    log.debug(f"Built system prompt for {persona_id} addressing {safe_user_name}")
    return system_prompt

# ═══════════════════════════════════════════════════════════════════════════════
#                               MAIN KERNEL WRAPPER
# ═══════════════════════════════════════════════════════════════════════════════

def build_global_kernel_wrapper(
    user_name: str = "there",
    index: Any = None
) -> callable:
    """
    Build the global kernel function with user context.

    Args:
        user_name: User's preferred name
        index: Pinecone index for memory operations

    Returns:
        Configured kernel function
    """
    def kernel(
        persona_id: str = "guardian",
        conversation_context: str = "",
        memory_limit: int = 3
    ) -> str:
        """
        Generate system prompt for specified persona with user context.

        Args:
            persona_id: Persona to activate
            conversation_context: Current conversation for memory search
            memory_limit: Maximum memories to retrieve

        Returns:
            Complete system prompt
        """
        log.info(f"Kernel activated for persona '{persona_id}' and user '{user_name}'")

        # Fetch relevant memories
        memory_pins = fetch_memory_pins(
            index=index,
            user_id=user_name,  # Using user_name as user_id for now
            search_context=conversation_context,
            persona_id=persona_id,
            limit=memory_limit
        )

        # Build and return system prompt
        return build_system_prompt(persona_id, memory_pins, user_name)

    return kernel

# ═══════════════════════════════════════════════════════════════════════════════
#                               TESTING AND UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def test_kernel_functionality() -> None:
    """Test kernel functionality without external dependencies."""
    print("Testing LYLO Kernel v32.0...")

    # Test persona validation
    assert validate_persona_id("guardian") == "guardian"
    assert validate_persona_id("INVALID") == "guardian"

    # Test memory block building
    test_memories = ["User prefers morning workouts", "Has anxiety about public speaking"]
    memory_block = build_memory_block(test_memories)
    assert "Memory 1:" in memory_block

    # Test prompt building
    prompt = build_system_prompt("bestie", test_memories, "Alice")
    assert "BESTIE" in prompt
    assert "Alice" in prompt

    print("✓ All kernel tests passed!")

if __name__ == "__main__":
    # Configure logging
    log.basicConfig(
        level=log.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Run tests
    test_kernel_functionality()

    print("LYLO Kernel v32.0 - Fixed version ready for deployment!")