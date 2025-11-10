# Configuration Files

## messages.py

에러 메시지와 사용자 대면 메시지를 중앙에서 관리하는 설정 파일입니다.

### 주요 기능

1. **환경별 메시지 관리**
   - 개발 모드: 상세한 에러 정보 포함
   - 프로덕션 모드: 사용자 친화적인 간단한 메시지

2. **환경 변수 설정**
   - `ENVIRONMENT`: 환경 설정 (development, staging, production)
   - `DEBUG_MODE`: 디버그 모드 (true/false)

### 사용 예시

```python
from app.config.messages import ErrorMessages, InfoMessages

# 에러 메시지 가져오기
user_message = ErrorMessages.get_message("chat_error", error=str(e))

# 개발용 상세 로그
error_detail = ErrorMessages.get_dev_detail("chat_error", error=str(e))
logger.error(f"[Error] {error_detail}")

# 정보성 메시지
message = InfoMessages.get_message("cart_added")
```

### 메시지 타입

#### ErrorMessages
- `chat_error`: 채팅 처리 오류
- `bedrock_error`: Bedrock API 호출 오류
- `tool_error`: Tool 실행 오류
- `db_error`: 데이터베이스 오류
- `validation_error`: 입력 검증 실패
- `cart_refresh_error`: 장바구니 갱신 오류
- `import_error`: 모듈 import 오류

#### InfoMessages
- `cart_added`: 장바구니 추가 완료
- `cart_empty`: 장바구니 비어있음
- `order_found`: 주문 내역 조회 성공
- `order_not_found`: 주문 내역 없음
- `reorder_single`: 단일 상품 재주문
- `reorder_multiple`: 다중 상품 재주문 옵션 표시

### 프로덕션 배포 시

1. 환경 변수 설정:
   ```bash
   export ENVIRONMENT=production
   export DEBUG_MODE=false
   ```

2. Docker Compose 설정:
   ```yaml
   environment:
     - ENVIRONMENT=production
     - DEBUG_MODE=false
   ```

3. 메시지 커스터마이징:
   - `messages.py`의 `PROD_MESSAGES` 딕셔너리 수정
   - 재배포 없이 메시지만 업데이트 가능
