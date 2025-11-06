import re

COMMAND_DICTIONARY = {
    "view_orders": {
        "keywords": [
            "주문 조회", "주문 확인", "주문 내역", "주문 목록", "주문목록",
            "내 주문", "구매 내역", "산 거", "주문조회", "주문확인",
            "샀던거", "샀던 거"
        ],
        "patterns": [r"주문.*조회", r"주문.*확인", r"주문.*내역", r"뭐.*샀"],
        "action": {"type": "VIEW_ORDERS", "params": {}},
        "reply": "주문 내역을 확인할게요!"
    },
    "view_cart": {
        "keywords": [
            "장바구니", "장바구니 보기", "장바구니 확인",
            "카트", "담은 거", "담은 상품", "장바구니확인"
        ],
        "patterns": [r"장바구니", r"카트", r"담은.*거"],
        "action": {"type": "VIEW_CART", "params": {}},
        "reply": "장바구니를 보여드릴게요!"
    },
    "track_delivery": {
        "keywords": [
            "배송 조회", "배송 확인", "택배 조회",
            "배송 추적", "어디까지 왔", "배송조회"
        ],
        "patterns": [r"배송.*조회", r"배송.*확인", r"어디.*왔"],
        "action": {"type": "TRACK_DELIVERY", "params": {}},
        "reply": "배송 현황을 확인할게요!"
    },
    "view_wishlist": {
        "keywords": ["찜", "찜 목록", "위시리스트", "관심 상품"],
        "patterns": [r"찜.*목록", r"관심.*상품"],
        "action": {"type": "VIEW_WISHLIST", "params": {}},
        "reply": "찜한 상품 목록이에요!"
    }
}

def match_command(user_input: str):
    """명령어 매칭 함수"""
    normalized = user_input.strip().lower()
    
    # 너무 짧으면 매칭 안함
    if len(normalized) < 2:
        return {"matched": False}
    
    for cmd_name, cmd_data in COMMAND_DICTIONARY.items():
        # 1. 키워드 매칭
        for keyword in cmd_data["keywords"]:
            if keyword in normalized:
                return {
                    "matched": True,
                    "command": cmd_name,
                    "action": cmd_data["action"],
                    "reply": cmd_data["reply"]
                }
                
    for pattern in cmd_data.get("patterns", []):
        # 2. 패턴 매칭
        if re.search(pattern, normalized):
            return {
                "matched": True,
                "command": cmd_name,
                "action": cmd_data["action"],
                "reply": cmd_data["reply"]
            }
            
    return {"matched": False}