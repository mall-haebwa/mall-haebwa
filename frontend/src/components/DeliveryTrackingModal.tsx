import { X, Package, Truck, CheckCircle2, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { generateDeliveryStatus } from "../utils/generateDeliveryStatus";
import { Badge } from "./ui/badge";

interface DeliveryTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  approvedAt: string;
  orderName: string;
}

export function DeliveryTrackingModal({
  isOpen,
  onClose,
  orderId,
  approvedAt,
  orderName,
}: DeliveryTrackingModalProps) {
  const delivery = generateDeliveryStatus(orderId, approvedAt, orderName);

  // 상태별 아이콘 및 색상
  const getStatusIcon = (status: string) => {
    if (status === "배송 완료") {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    } else if (status.includes("배송")) {
      return <Truck className="h-5 w-5 text-blue-600" />;
    } else if (status.includes("준비")) {
      return <Package className="h-5 w-5 text-orange-600" />;
    } else {
      return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "배송 완료") return "bg-green-100 text-green-700";
    if (status.includes("배송")) return "bg-blue-100 text-blue-700";
    if (status.includes("준비")) return "bg-orange-100 text-orange-700";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">배송 조회</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* 주문 정보 요약 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500">주문번호</p>
                <p className="font-mono text-sm font-medium">{orderId}</p>
              </div>
              <Badge className={getStatusColor(delivery.currentStatus)}>
                {delivery.currentStatus}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500">상품명</p>
              <p className="text-sm font-medium">{orderName}</p>
            </div>
          </div>

          {/* 택배사 정보 */}
          <div className="border-l-4 border-blue-500 pl-4 space-y-1">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-lg">{delivery.courier}</span>
            </div>
            <p className="text-sm text-gray-600">
              송장번호: <span className="font-mono">{delivery.trackingNumber}</span>
            </p>
            <p className="text-sm text-gray-600">
              예상 배송일: <span className="font-medium">{delivery.estimatedDelivery}</span>
            </p>
          </div>

          {/* 배송 단계 타임라인 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-base">배송 추적</h3>
            <div className="relative">
              {delivery.steps.map((step, index) => (
                <div key={index} className="flex gap-4 pb-8 last:pb-0">
                  {/* 아이콘 및 세로선 */}
                  <div className="relative flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-200 bg-white">
                      {getStatusIcon(step.status)}
                    </div>
                    {index < delivery.steps.length - 1 && (
                      <div className="h-full w-0.5 bg-gray-200 absolute top-10" />
                    )}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{step.status}</p>
                        <p className="text-sm text-gray-600">{step.location}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {step.description}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 whitespace-nowrap">
                        {step.timestamp}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 안내 메시지 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">📦 배송 안내</p>
            <ul className="space-y-1 text-xs">
              <li>• 배송 정보는 실시간으로 업데이트됩니다.</li>
              <li>• 기상 상황에 따라 배송이 지연될 수 있습니다.</li>
              <li>• 문의사항은 고객센터로 연락 주세요.</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
