"""
Command Matcher → LLM Resolver 순서로 의도 파악
"""

from typing import List, Dict, Optional
from .command_matcher import CommandMatcher
from .llm_intent_resolver import LLMIntentResolver
from .intent_types import Intent

class IntentParser:
    """
    2단계 의도 파악 시스템
    1. 빠른 정규식 매칭 시도
    2. 실패 시 LLM 호출
    """

    def __init__(self):
        self.command_matcher = CommandMatcher()

    async def parse(
        self, 
        message: str, 
        conversation_history: Optional[List[Dict]] = None
    ) -> Intent:
        """
        메시지에서 의도 파악
        
        Args:
            message: 사용자 메시지
            conversation_history: 대화 히스토리 (LLM 컨텍스트용)
            
        Returns:
            Intent: 파악된 의도
        """
        # # 1단계: 빠른 매칭 시도
        # intent = self.command_matcher.match(message)
        # if intent:
        #     print(f"✓ Command Matcher 성공: {intent.type.value}")
        #     return intent

        # 2단계: LLM 호출 - 현재 모든 Intent를 LLM이 처리
        print("LLM으로 Intent 파악 시작")
        resolver = LLMIntentResolver(conversation_history)
        intent = await resolver.resolve(message)
        print(f"✓ LLM Resolver 결과: {intent.type.value} (confidence: {intent.confidence})")

        return intent