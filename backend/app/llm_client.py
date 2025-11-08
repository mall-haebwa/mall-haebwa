from google import genai
from typing import List, Dict, Optional
import os
import traceback
import logging

logger = logging.getLogger(__name__)

class GeminiClient:
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash"):
        """제미나이 클라이언트 초기화 (새 SDK)"""
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    async def chat(
        self,
        messages: List[Dict[str, str]],
        images: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000
    ):
        """제미나이 API 호출 (async, 새 SDK)"""
        try:
            print(f"[LLM] Starting chat with {len(messages)} messages")
            print(f"[LLM] Model: {self.model_name}")
            print(
                f"[LLM] Temperature: {temperature}, Max tokens: {max_tokens}")

            # 새 SDK는 OpenAI 스타일의 메시지 형식을 그대로 사용
            # System 프롬프트 포함 전체 메시지를 하나의 contents로 변환

            # System 메시지를 컨텍스트로 처리
            system_instruction = None
            chat_messages = messages.copy()

            if messages and messages[0]["role"] == "system":
                system_instruction = messages[0]["content"]
                chat_messages = messages[1:]
                print(
                    f"[LLM] System instruction detected (length: {len(system_instruction)})")

        # 메시지를 단일 프롬프트로 결합
            # 새 SDK는 대화 히스토리를 자동으로 처리하지 않으므로 직접 구성
            prompt_parts = []

            if system_instruction:
                prompt_parts.append(f"시스템 지침:\n{system_instruction}\n")

            # 이전 대화 히스토리 추가 (있다면)
            for msg in chat_messages[:-1]:
                role = msg["role"]
                content = msg["content"]
                if role == "user":
                    prompt_parts.append(f"사용자: {content}")
                elif role == "assistant":
                    prompt_parts.append(f"어시스턴트: {content}")

            # 현재 사용자 메시지
            current_message = chat_messages[-1]["content"]
            prompt_parts.append(f"사용자: {current_message}")
            # prompt_parts.append("어시스턴트:")

            full_prompt = "\n\n".join(prompt_parts)
            print(f"[LLM] Sending request to Gemini API...")
            print(f"[LLM] Current user message: {current_message}")

            # 멀티모달 컨텐츠 구성
            parts = []

            # 텍스트 추가
            parts.append({"text": full_prompt})

            # 이미지가 있을 경우 추가
            if images:
                for img in images:
                    parts.append({
                        "inline_data": {
                            "mime_type": img["mime_type"],
                            "data": img["data"]
                        }
                    })

            # 새 SDK로 API 호출
            response = self.client.models.generate_content(
                model=self.model_name,
                contents={"role": "user", "parts": parts},
                config={
                    "temperature": temperature,
                    "max_output_tokens": max_tokens,
                    "response_mime_type": "text/plain",
                }
            )

            response_text = response.text if response.text else ""
            if not response_text:   # response_text가 None인 경우 처리
                # 빈 응답 시 즉시 fallback으로 전환
                logger.warning(f"[LLM] Empty response - using fallback")
                return None  # reply_generator에서 _get_fallback_reply 호출하도록

            print(f"[LLM] Response received (length: {len(response_text)})")
            print(f"[LLM] Response text: {response_text[:200]}...")

            return response_text

        except Exception as e:
            print(f"\n{'='*60}")
            print(f"[LLM ERROR] Exception Type: {type(e).__name__}")
            print(f"[LLM ERROR] Exception Message: {str(e)}")
            print(f"[LLM ERROR] Full Traceback:")
            print(traceback.format_exc())
            print(f"{'='*60}\n")
            return "죄송합니다. 일시적인 오류가 발생했어요. 다시 시도해주세요."


# llm_client 인스턴스 생성
GEMINI_API_KEY = os.getenv(
    "GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

print(f"\n{'='*60}")
print("[LLM Init] Initializing Gemini Client (New SDK)...")
print(f"[LLM Init] API Key present: {bool(GEMINI_API_KEY)}")
if GEMINI_API_KEY:
    print(f"[LLM Init] API Key (first 10 chars): {GEMINI_API_KEY[:10]}...")
print(f"[LLM Init] Model: {GEMINI_MODEL}")
print(f"{'='*60}\n")

if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found in environment variables")
    llm_client = None
else:
    try:
        llm_client = GeminiClient(
            api_key=GEMINI_API_KEY, model_name=GEMINI_MODEL)
        print("[LLM Init] ✓ Gemini Client initialized successfully with new SDK")
    except Exception as e:
        print(f"[LLM Init] ✗ Failed to initialize Gemini Client: {e}")
        print(traceback.format_exc())
        llm_client = None
