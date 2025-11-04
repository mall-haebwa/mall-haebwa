import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAppState } from "../context/app-state";
import type { PaymentResult } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_URL = ((import.meta as any).env?.VITE_API_URL as string | undefined) || "";

const withBase = (path: string) => (API_URL ? `${API_URL}${path}` : path);

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const { refreshCart, currentUser } = useAppState();
  const hasConfirmed = useRef(false);

  // 페이지 마운트 시에도 장바구니 새로고침 (백업)
  useEffect(() => {
    if (currentUser && !loading) {
      console.log("🔄 결제 완료 페이지 표시 중 - 장바구니 새로고침");
      refreshCart();
    }
  }, [currentUser, loading, refreshCart]);

  useEffect(() => {
    // 중복 요청 방지
    if (hasConfirmed.current) return;

    async function confirmPayment() {
      const paymentKey = searchParams.get("paymentKey");
      const orderId = searchParams.get("orderId");
      const amount = searchParams.get("amount");

      if (!paymentKey || !orderId || !amount) {
        alert("잘못된 접근입니다.");
        navigate("/");
        return;
      }

      hasConfirmed.current = true;

      try {
        // 서버에 결제 승인 요청
        const response = await fetch(withBase("/api/payment/confirm"), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payment_key: paymentKey,
            order_id: orderId,
            amount: parseInt(amount, 10),
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setResult(data.payment);

          // 서버에서 장바구니 삭제가 이미 완료되었으므로 클라이언트 장바구니를 새로고침
          console.log("🔄 서버에서 장바구니 삭제 완료, 클라이언트 장바구니 새로고침 중...");

          // 장바구니 새로고침 (여러 번 재시도)
          const tryRefresh = async (retries = 3) => {
            for (let i = 0; i < retries; i++) {
              if (currentUser || i > 0) {
                try {
                  await refreshCart();
                  console.log(`✅ 장바구니 새로고침 완료 (시도 ${i + 1}/${retries})`);
                  return;
                } catch (error) {
                  console.warn(`⚠️ 장바구니 새로고침 실패 (시도 ${i + 1}/${retries})`, error);
                }
              }

              if (i < retries - 1) {
                console.log(`⏳ currentUser 로드 대기 중... (${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }
            console.warn("⚠️ 장바구니 새로고침 최종 실패");
          };

          await tryRefresh();
        } else {
          throw new Error(data.detail);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류";
        alert("결제 승인에 실패했습니다: " + message);
        navigate("/");
      } finally {
        setLoading(false);
      }
    }

    confirmPayment();
  }, [searchParams, navigate, refreshCart, currentUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg">결제 처리 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">결제 완료!</h1>
        <p className="text-gray-600 mb-6">결제가 성공적으로 완료되었습니다.</p>
        {result && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
            <div className="space-y-2">
              <p>
                <strong>주문번호:</strong> {result.orderId}
              </p>
              <p>
                <strong>결제금액:</strong> {result.totalAmount.toLocaleString()}
                원
              </p>
              <p>
                <strong>결제방법:</strong> {result.method}
              </p>
              <p>
                <strong>승인시각:</strong>{" "}
                {new Date(result.approvedAt).toLocaleString("ko-KR")}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate("/orders")}
            className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-black"
          >
            주문 내역 보기
          </button>
          <button
            onClick={() => navigate("/")}
            className="bg-white text-gray-900 px-6 py-3 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
