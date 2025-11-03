"""
LM Studio LLM 클라이언트
로컬에서 실행 중인 LM Studio API와 통신
"""

from openai import AsyncOpenAI
import os
from typing import List, Dict, Optional


class LMStudioClient:
    """LM Studio API 클라이언트"""

    def __init__(self):
        """
        환경변수에서 설정 로드
        - LM_STUDIO_BASE_URL: LM Studio 서버 주소
        - LM_STUDIO_MODEL: 사용할 모델명
        """
        self.base_url = os.getenv(
            "LM_STUDIO_BASE_URL",
            "http://host.docker.internal:1234/v1"
        )
        self.model = os.getenv(
            "LM_STUDIO_MODEL",
            "llama-3.1-8b-instruct"
        )

        # OpenAI 호환 비동기 클라이언트 생성
        self.client = AsyncOpenAI(
            base_url=self.base_url,
            api_key="not-needed"  # LM Studio는 API 키 불필요
        )

    async def chat(
            self,
            messages: List[Dict[str, str]],
            temperature: float = 0.7,
            max_tokens: int = 500,
            stream: bool = False
    ) -> str:
        """
        채팅 완성 요청

        Args:
            messages: 대화 메시지 리스트
                [{"role": "user", "content": "안녕?"}]
            temperature: 응답 랜덤성 (0.0~1.0)
            max_tokens: 최대 토큰 수
            stream: 스트리밍 여부

        Returns:
            LLM 응답 텍스트
        """
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=stream
            )

            if stream:
                # 스트리밍 모드 (나중에 구현)
                return response
            else:
                return response.choices[0].message.content

        except Exception as e:
            raise Exception(f"LM Studio 요청 실패: {str(e)}")

    async def generate_intent_analysis(self, user_query: str) -> str:
        """
        사용자 쿼리에서 의도 분석

        Args:
            user_query: 사용자 입력 ("김치찌개 먹고 싶다")

        Returns:
            의도 분석 결과 (JSON 형식 문자열)
        """
        system_prompt = """당신은 쇼핑몰 AI 어시스턴트입니다.
사용자의 요청을 분석하여 다음 JSON 형식으로 응답하세요:

{
  "intent": "음식 요리",
  "keywords": ["김치찌개", "재료"],
  "suggestions": {
    "meal_kit": "김치찌개 밀키트를 추천드립니다.",
    "ingredients": "김치, 돼지고기, 두부를 개별 구매할 수 있습니다."
  }
}

반드시 JSON 형식으로만 응답하세요."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_query}
        ]

        return await self.chat(messages, temperature=0.3, max_tokens=300)

    async def test_connection(self) -> bool:
        """
        LM Studio 연결 테스트

        Returns:
            연결 성공 여부
        """
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=10
            )
            return True
        except Exception as e:
            print(f"❌ LM Studio 연결 실패: {e}")
            return False


# 싱글톤 인스턴스
llm_client = LMStudioClient()
