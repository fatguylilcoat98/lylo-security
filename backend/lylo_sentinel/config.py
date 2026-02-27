"""lylo_sentinel.config — constants shared across sentinel modules."""
import os

# Static 1536-dim anchor vector used for all sentinel Pinecone records
# (records are fetched by ID, not by ANN search, so the vector value doesn't matter)
SENTINEL_ANCHOR_VECTOR = [0.0] * 1536

# Pinecone
PINECONE_API_KEY   = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX     = os.getenv("PINECONE_INDEX", "lylo-memory")
