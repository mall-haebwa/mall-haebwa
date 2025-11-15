"""AWS Bedrock Client with Tool Use support"""
import boto3
import json
import logging
import os
import time
import asyncio
from typing import List, Dict, Any, Optional, Callable
from botocore.config import Config
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class BedrockClient:
    """AWS Bedrock Claude 클라이언트 (Tool Use 지원)"""

    def __init__(self):
        """
        Bedrock 클라이언트 초기화 (환경 변수에서 자동 로드)

        필요한 환경 변수:
        - AWS_BEARER_TOKEN_BEDROCK (Bedrock API 키)
        - AWS_REGION (기본: us-east-1)
        - AWS_BEDROCK_MODEL_ID (기본: anthropic.claude-3-haiku-20240307-v1:0)
        """
        # 환경 변수에서 직접 읽기
        self.bearer_token = os.getenv("AWS_BEARER_TOKEN_BEDROCK")
        self.region_name = os.getenv("AWS_REGION", "us-east-1")
        self.model_id = os.getenv("AWS_BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0")

        if not self.bearer_token:
            raise ValueError("AWS_BEARER_TOKEN_BEDROCK must be set")

        # Retry 설정 (exponential backoff)
        retry_config = Config(
            retries={
                'max_attempts': 5,
                'mode': 'adaptive'  # Exponential backoff with adaptive retry
            }
        )

        # Bedrock Runtime 클라이언트 생성 (토큰 직접 전달)
        # boto3가 환경 변수를 자동으로 읽으므로 os.environ 수정 불필요
        self.client = boto3.client(
            service_name="bedrock-runtime",
            region_name=self.region_name,
            aws_access_key_id=None,
            aws_secret_access_key=None,
            aws_session_token=self.bearer_token,  # Bearer 토큰 직접 전달
            config=retry_config
        )

        # Rate limiting 설정
        self.last_api_call_time = 0
        self.min_call_interval = 0.0  # Rate limiting 비활성화 (빠른 응답)

        logger.info(f"✓ Bedrock Client initialized (model: {self.model_id}, region: {self.region_name})")

    async def chat_with_tools(
        self,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
        tool_handlers: Dict[str, Callable],
        max_iterations: int = 5,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        enable_caching: bool = True
    ) -> Dict[str, Any]:
        """
        Tool Use를 지원하는 채팅 (자동 Tool 실행 루프)

        Args:
            messages: 대화 메시지 리스트 [{"role": "user/assistant/system", "content": "..."}]
            tools: Bedrock Tool 정의 리스트
            tool_handlers: Tool 이름 → 실행 함수 매핑 {"tool_name": async_function}
            max_iterations: 최대 Tool 실행 반복 횟수
            temperature: 생성 온도 (0.0~1.0)
            max_tokens: 최대 토큰 수

        Returns:
            {
                "response": "최종 텍스트 응답",
                "tool_calls": [...],  # 실행된 Tool 목록
                "stop_reason": "end_turn" | "max_tokens" | "tool_use",
                "usage": {...}  # 토큰 사용량
            }
        """
        # System 메시지 추출
        system_prompt = ""
        conversation_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_prompt = msg["content"]
            else:
                conversation_messages.append({
                    "role": msg["role"],
                    "content": [{"text": msg["content"]}]
                })

        # Tool Use 루프
        tool_calls_history = []
        iteration = 0

        while iteration < max_iterations:
            iteration += 1
            logger.info(f"[Bedrock] Iteration {iteration}/{max_iterations}")

            try:
                # Rate limiting: API 호출 간격 제한
                current_time = time.time()
                time_since_last_call = current_time - self.last_api_call_time
                if time_since_last_call < self.min_call_interval:
                    wait_time = self.min_call_interval - time_since_last_call
                    logger.debug(f"[Bedrock] Rate limiting: waiting {wait_time:.2f}s")
                    await asyncio.sleep(wait_time)

                # Bedrock Converse API 호출
                request_params = {
                    "modelId": self.model_id,
                    "messages": conversation_messages,
                    "inferenceConfig": {
                        "temperature": temperature,
                        "maxTokens": max_tokens
                    }
                }

                # System prompt 추가
                if system_prompt:
                    if enable_caching:
                        request_params["system"] = [
                            {"text": system_prompt},
                            {"cachePoint": {"type": "default"}}
                        ]
                        if iteration == 1:
                            logger.info(f"[Bedrock] Prompt Caching enabled")
                    else:
                        request_params["system"] = [{"text": system_prompt}]

                # Tools 추가
                if tools:
                    request_params["toolConfig"] = {
                        "tools": tools
                    }

                # API 호출 (ThrottlingException 발생 시 재시도)
                max_retries = 3
                retry_delay = 2.0

                for retry in range(max_retries):
                    try:
                        response = self.client.converse(**request_params)
                        self.last_api_call_time = time.time()

                        usage = response.get("usage", {})
                        cache_read = usage.get("cacheReadInputTokens", 0)
                        cache_write = usage.get("cacheWriteInputTokens", 0)
                        input_tokens = usage.get("inputTokens", 0)
                        output_tokens = usage.get("outputTokens", 0)
                        total_tokens = usage.get("totalTokens", 0)

                        if cache_read > 0:
                            logger.info(f"[Bedrock] 💾 Prompt Cache HIT ({cache_read:,} tokens cached) | In: {input_tokens:,}, Out: {output_tokens:,}, Total: {total_tokens:,}")
                        elif cache_write > 0:
                            logger.info(f"[Bedrock] 💾 Prompt Cache MISS (writing {cache_write:,} tokens) | In: {input_tokens:,}, Out: {output_tokens:,}, Total: {total_tokens:,}")
                        else:
                            logger.info(f"[Bedrock] 📊 Tokens | In: {input_tokens:,}, Out: {output_tokens:,}, Total: {total_tokens:,}")
                        
                        break

                    except ClientError as e:
                        error_code = e.response.get('Error', {}).get('Code', '')
                        if error_code == 'ThrottlingException':
                            if retry < max_retries - 1:
                                wait_time = retry_delay * (2 ** retry)  # Exponential backoff
                                logger.warning(f"[Bedrock] ThrottlingException: waiting {wait_time:.1f}s before retry {retry+1}/{max_retries}")
                                await asyncio.sleep(wait_time)
                            else:
                                logger.error(f"[Bedrock] ThrottlingException: max retries reached")
                                raise
                        else:
                            raise

                # 응답 파싱
                stop_reason = response.get("stopReason")
                output_message = response.get("output", {}).get("message", {})
                content_blocks = output_message.get("content", [])

                logger.info(f"[Bedrock] Stop reason: {stop_reason}")

                # Assistant 메시지 추가
                conversation_messages.append({
                    "role": "assistant",
                    "content": content_blocks
                })

                # Tool Use 확인
                if stop_reason == "tool_use":
                    logger.info(f"[Bedrock] 🔧 Tool use detected - executing tools...")
                    # Tool 실행
                    tool_results = []

                    for block in content_blocks:
                        if "toolUse" in block:
                            tool_use = block["toolUse"]
                            tool_name = tool_use["name"]
                            tool_input = tool_use["input"]
                            tool_use_id = tool_use["toolUseId"]

                            logger.info(f"[Bedrock] 🔧 Tool called: {tool_name}")
                            logger.info(f"[Bedrock] Tool input: {json.dumps(tool_input, ensure_ascii=False)}")

                            # Tool 실행
                            if tool_name in tool_handlers:
                                try:
                                    handler = tool_handlers[tool_name]
                                    tool_result = await handler(**tool_input)

                                    tool_calls_history.append({
                                        "name": tool_name,
                                        "input": tool_input,
                                        "result": tool_result
                                    })

                                    tool_results.append({
                                        "toolResult": {
                                            "toolUseId": tool_use_id,
                                            "content": [{"json": tool_result}]
                                        }
                                    })

                                    logger.info(f"[Bedrock] ✅ Tool executed: {tool_name}")
                                    logger.info(f"[Bedrock] Tool result preview: {str(tool_result)[:200]}")

                                except Exception as e:
                                    logger.error(f"[Bedrock] Tool execution error: {e}", exc_info=True)
                                    tool_results.append({
                                        "toolResult": {
                                            "toolUseId": tool_use_id,
                                            "content": [{"text": f"Error: {str(e)}"}],
                                            "status": "error"
                                        }
                                    })
                            else:
                                logger.warning(f"[Bedrock] Unknown tool: {tool_name}")
                                tool_results.append({
                                    "toolResult": {
                                        "toolUseId": tool_use_id,
                                        "content": [{"text": f"Unknown tool: {tool_name}"}],
                                        "status": "error"
                                    }
                                })

                    # Tool 결과를 다음 메시지로 추가
                    conversation_messages.append({
                        "role": "user",
                        "content": tool_results
                    })

                    logger.info(f"[Bedrock] 🔄 Tool results sent to LLM - continuing conversation...")
                    # 다음 반복 계속
                    continue

                # 최종 응답 추출
                final_text = ""
                for block in content_blocks:
                    if "text" in block:
                        final_text += block["text"]

                logger.info(f"[Bedrock] 💬 Final response generated: {final_text[:100]}")
                return {
                    "response": final_text.strip(),
                    "tool_calls": tool_calls_history,
                    "stop_reason": stop_reason,
                    "usage": response.get("usage", {})
                }

            except Exception as e:
                logger.error(f"[Bedrock] API call error: {e}", exc_info=True)
                return {
                    "response": "죄송합니다. 일시적인 오류가 발생했어요. 다시 시도해주세요.",
                    "tool_calls": tool_calls_history,
                    "stop_reason": "error",
                    "error": str(e)
                }

        # Max iterations 도달
        logger.warning(f"[Bedrock] Max iterations ({max_iterations}) reached")
        return {
            "response": "처리 중 문제가 발생했습니다. 다시 시도해주세요.",
            "tool_calls": tool_calls_history,
            "stop_reason": "max_iterations"
        }


# 전역 Bedrock 클라이언트 인스턴스
def create_bedrock_client() -> Optional[BedrockClient]:
    """Bedrock 클라이언트 생성 (환경 변수 체크 포함)"""
    bearer_token = os.getenv("AWS_BEARER_TOKEN_BEDROCK")

    # 환경 변수 미설정 체크
    if not bearer_token:
        logger.warning("[Bedrock] AWS_BEARER_TOKEN_BEDROCK not found in environment")
        return None

    # Placeholder 값 체크
    if bearer_token.startswith("your-"):
        logger.warning("[Bedrock] AWS_BEARER_TOKEN_BEDROCK not configured (using placeholder value)")
        return None

    try:
        client = BedrockClient()
        logger.info("[Bedrock] ✓ Client ready")
        return client
    except Exception as e:
        logger.error(f"[Bedrock] Failed to create client: {e}")
        return None


# 전역 인스턴스 (앱 시작 시 자동 생성)
bedrock_client = create_bedrock_client()

if bedrock_client is None:
    logger.info("[Bedrock] ✗ Client not available (will use Gemini fallback)")
