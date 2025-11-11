"""
Tool Registry for automatic tool registration with decorators

Usage:
    @tool(
        name="search_products",
        description="Search for products",
        input_schema={...},
        requires_auth=False
    )
    async def search_products(self, query: str, ...):
        # implementation
        pass
"""

from typing import Dict, Any, Callable, List, Optional
import functools
import logging

logger = logging.getLogger(__name__)


class ToolRegistry:
    """자동 Tool 등록 레지스트리"""

    _tools: List[Dict[str, Any]] = []
    _handlers: Dict[str, Callable] = {}
    _auth_required: set = set()

    @classmethod
    def tool(
        cls,
        name: str,
        description: str,
        input_schema: Dict[str, Any],
        requires_auth: bool = False
    ):
        """
        Tool 자동 등록 데코레이터

        Args:
            name: Tool 이름
            description: Tool 설명
            input_schema: Bedrock Tool inputSchema (JSON Schema)
            requires_auth: 인증 필요 여부
        """
        def decorator(func: Callable):
            # Tool 정의 추가
            tool_def = {
                "toolSpec": {
                    "name": name,
                    "description": description,
                    "inputSchema": {
                        "json": input_schema
                    }
                }
            }
            cls._tools.append(tool_def)

            # Handler 등록
            cls._handlers[name] = func

            # 인증 필요 여부 등록
            if requires_auth:
                cls._auth_required.add(name)

            logger.info(f"[ToolRegistry] Registered tool: {name} (auth={requires_auth})")

            return func

        return decorator

    @classmethod
    def get_tools(cls) -> List[Dict[str, Any]]:
        """등록된 모든 Tool 정의 반환"""
        return cls._tools.copy()

    @classmethod
    def get_handlers(cls) -> Dict[str, Callable]:
        """등록된 모든 Handler 반환"""
        return cls._handlers.copy()

    @classmethod
    def get_auth_required(cls) -> set:
        """인증이 필요한 Tool 목록 반환"""
        return cls._auth_required.copy()

    @classmethod
    def clear(cls):
        """등록 초기화 (테스트용)"""
        cls._tools.clear()
        cls._handlers.clear()
        cls._auth_required.clear()


# 편의를 위한 alias
tool = ToolRegistry.tool
