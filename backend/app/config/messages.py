"""Error messages and user-facing messages configuration"""
import os

# 환경 변수로 프로덕션 모드 확인
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"
DEBUG_MODE = os.getenv("DEBUG_MODE", "true").lower() == "true"


class ErrorMessages:
    """에러 메시지 관리"""

    # 개발 모드용 상세 메시지
    DEV_MESSAGES = {
        "chat_error": "채팅 처리 중 오류가 발생했습니다: {error}",
        "bedrock_error": "Bedrock API 호출 중 오류 발생: {error}",
        "tool_error": "Tool 실행 중 오류 발생 ({tool_name}): {error}",
        "db_error": "데이터베이스 오류: {error}",
        "validation_error": "입력 값 검증 실패: {error}",
        "cart_refresh_error": "장바구니 갱신 중 오류: {error}",
        "import_error": "모듈 import 오류: {error}",
    }

    # 프로덕션 모드용 사용자 친화적 메시지
    PROD_MESSAGES = {
        "chat_error": "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        "bedrock_error": "AI 서비스 응답 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
        "tool_error": "요청 처리 중 문제가 발생했습니다. 다시 시도해주세요.",
        "db_error": "데이터 조회 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
        "validation_error": "입력하신 정보를 확인해주세요.",
        "cart_refresh_error": "장바구니 정보를 불러오는 중 문제가 발생했습니다.",
        "import_error": "시스템 오류가 발생했습니다. 관리자에게 문의해주세요.",
    }

    @classmethod
    def get_message(cls, error_type: str, **kwargs) -> str:
        """
        에러 타입에 맞는 메시지 반환

        Args:
            error_type: 에러 타입 (DEV_MESSAGES/PROD_MESSAGES의 키)
            **kwargs: 메시지 포맷용 파라미터

        Returns:
            포맷된 에러 메시지
        """
        if IS_PRODUCTION and not DEBUG_MODE:
            # 프로덕션 모드: 사용자 친화적 메시지
            message = cls.PROD_MESSAGES.get(error_type, cls.PROD_MESSAGES["chat_error"])
        else:
            # 개발 모드: 상세 메시지
            message = cls.DEV_MESSAGES.get(error_type, cls.DEV_MESSAGES["chat_error"])
            message = message.format(**kwargs)

        return message

    @classmethod
    def get_dev_detail(cls, error_type: str, **kwargs) -> str:
        """개발용 상세 메시지 (로그용)"""
        message = cls.DEV_MESSAGES.get(error_type, cls.DEV_MESSAGES["chat_error"])
        return message.format(**kwargs)


class InfoMessages:
    """정보성 메시지 관리"""

    MESSAGES = {
        "cart_added": "상품을 장바구니에 담았습니다.",
        "cart_empty": "장바구니가 비어있습니다.",
        "order_found": "주문 내역을 찾았습니다.",
        "order_not_found": "주문 내역이 없습니다.",
        "reorder_single": "'{product_name}'을(를) 장바구니에 담았습니다.",
        "reorder_multiple": "{count}개의 상품을 찾았습니다. 왼쪽 화면에서 원하시는 상품을 선택해주세요.",
    }

    @classmethod
    def get_message(cls, message_type: str, **kwargs) -> str:
        """메시지 타입에 맞는 메시지 반환"""
        message = cls.MESSAGES.get(message_type, "")
        return message.format(**kwargs) if kwargs else message
