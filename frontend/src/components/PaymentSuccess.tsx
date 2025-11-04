import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function confirmPayment() {
      const paymentKey = searchParams.get("paymentKey");
      const orderId = searchParams.get("orderId");
      const amount = searchParams.get("amount");

      if (!paymentKey || !orderId || !amount) {
        alert("잘못된 접근입니다.");
        navigate("/");
        return;
      }

      try {
        // 서버에 결제 승인 요청
        const response = await fetch(
          "http://localhost:8000/api/payment/confirm",
          {
            method: "POST",
            credentials: "include", // 쿠키 전송을 위해 필요
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              payment_key: paymentKey,
              order_id: orderId,
              amount: parseInt(amount),
            }),
          }
        );

        const data = await response.json();

        if (response.ok) {
          setResult(data.payment);
        } else {
          throw new Error(data.detail);
        }
      } catch (error) {
        alert("결제 승인에 실패했습니다: " + error.message);
        navigate("/");
      } finally {
        setLoading(false);
      }
    }

    confirmPayment();
  }, [searchParams, navigate]);

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
