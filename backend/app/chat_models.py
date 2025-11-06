from pydantic import BaseModel
from typing import Optional, Dict

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    
class ChatResponse(BaseModel):
    reply: str
    action: Optional[Dict] = None
    conversation_id: str
    llm_used: bool
    processing_time_ms: int
    
