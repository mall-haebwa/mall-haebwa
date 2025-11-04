// 배송 상태 생성 유틸 함수
// 주문 데이터를 기반으로 결정론적 배송 현황 생성

export interface DeliveryStep {
  status: string;
  location: string;
  timestamp: string;
  description: string;
}

export interface DeliveryStatus {
  courier: string; // 택배사명
  trackingNumber: string; // 추적번호
  currentStatus: "준비중" | "배송중" | "배송완료";
  estimatedDelivery: string; // 예상 배송일
  steps: DeliveryStep[];
}

// 간단한 문자열 해시 함수
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// 택배사 목록
const COURIERS = ["CJ대한통운", "한진택배", "로젠택배"];

// 터미널 목록
const TERMINALS = [
  "서울물류센터",
  "경기북부센터",
  "인천센터",
  "대전센터",
  "대구센터",
  "부산센터",
  "광주센터",
];

export function generateDeliveryStatus(
  orderId: string,
  approvedAt: string,
  orderName: string
): DeliveryStatus {
  const hash = simpleHash(orderId);

  // 택배사 선택 (결정론적)
  const courier = COURIERS[hash % COURIERS.length];

  // 추적번호 생성
  const courierCode = courier.substring(0, 2);
  const trackingNumber = `${courierCode}${String(hash)
    .substring(0, 12)
    .padStart(12, "0")}`;

  // 주문 날짜 파싱
  const orderDate = new Date(approvedAt);
  const now = new Date();
  const daysPassed = Math.floor(
    (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // 배송 단계 결정
  let currentStatus: "준비중" | "배송중" | "배송완료";
  if (daysPassed < 1) {
    currentStatus = "준비중";
  } else if (daysPassed < 4) {
    currentStatus = "배송중";
  } else {
    currentStatus = "배송완료";
  }

  // 예상 배송일 계산
  const estimatedDate = new Date(orderDate);
  estimatedDate.setDate(estimatedDate.getDate() + 3 + (hash % 2)); // 3-4일
  const estimatedDelivery = estimatedDate.toLocaleDateString("ko-KR");

  // 배송 단계 생성
  const steps: DeliveryStep[] = [];

  // 1. 상품 준비 중
  const prepDate = new Date(orderDate);
  prepDate.setHours(orderDate.getHours() + 2);
  steps.push({
    status: "상품 준비 중",
    location: "판매자 창고",
    timestamp: prepDate.toLocaleString("ko-KR"),
    description: `${orderName} 상품 포장 완료`,
  });

  if (daysPassed >= 1) {
    // 3. 터미널 경유
    const terminal = TERMINALS[(hash * 7) % TERMINALS.length];
    const transitDate = new Date(orderDate);
    transitDate.setDate(transitDate.getDate() + 2);
    transitDate.setHours(14);
    steps.push({
      status: "배송 중",
      location: terminal,
      timestamp: transitDate.toLocaleString("ko-KR"),
      description: "터미널 도착, 배송 준비 중",
    });

    // 4. 배송 차량 상차
    const loadDate = new Date(orderDate);
    loadDate.setDate(loadDate.getDate() + 2);
    loadDate.setHours(18);
    steps.push({
      status: "배송 중",
      location: `${terminal} 배송 출발`,
      timestamp: loadDate.toLocaleString("ko-KR"),
      description: "배송 기사님께 상품 인계 완료",
    });
  }

  if (daysPassed >= 4) {
    // 5. 배송 완료
    const deliveredDate = new Date(orderDate);
    deliveredDate.setDate(deliveredDate.getDate() + 3 + (hash % 2));
    deliveredDate.setHours(11 + (hash % 6));
    steps.push({
      status: "배송 완료",
      location: "자택",
      timestamp: deliveredDate.toLocaleString("ko-KR"),
      description: "배송 완료 (부재 시 현관 앞 보관)",
    });
  }

  return {
    courier,
    trackingNumber,
    currentStatus,
    estimatedDelivery,
    steps,
  };
}
