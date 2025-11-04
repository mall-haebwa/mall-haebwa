import { useSearchParams, useNavigate } from "react-router-dom";

export default function PaymentFail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const message = searchParams.get("message");

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="text-3xl font-bold mb-4 text-red-600">결제 실패</h1>
        <p className="text-gray-600 mb-6">
          {message
            ? decodeURIComponent(message)
            : "결제가 취소되었거나 실패했습니다."}
        </p>

        <button
          onClick={() => navigate(-1)}
          className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-black"
        >
          다시 시도하기
        </button>
      </div>
    </div>
  );
}
