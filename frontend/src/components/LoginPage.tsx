import { useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAppState } from "../context/app-state";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import axios from "axios";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAppState();
  const [email, setEmail] = useState(
    typeof location.state?.email === "string" ? location.state.email : ""
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    console.log("[LoginPage v2] 로그인 시도 시작");

    // 에러 초기화
    setLoginError("");

    if (!email || !password) {
      setLoginError("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        "/api/auth/login",
        {
          email,
          password,
          remember: rememberMe,
        },
        {
          withCredentials: true, // 쿠키 전송을 위해 필요
          timeout: 10000, // 10초 타임아웃
          skipAuthRefresh: true, // 로그인은 인터셉터 건너뛰기
        } as any
      );

      const user = response.data;

      login({
        id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone || "",
        address: user.address || "",
        points: typeof user.points === "number" ? user.points : 0,
        recentlyViewed: Array.isArray(user.recentlyViewed)
          ? user.recentlyViewed
          : [],
        isSeller: user.isSeller || false,
        sellerInfo: user.sellerInfo || undefined,
      });

      toast.success(`환영합니다, ${user.name}님!`);
      navigate("/");
    } catch (error: any) {
      console.error("[LoginPage v2] Login error:", error);
      let errorMessage = "로그인에 실패했습니다.";

      if (error.response) {
        // 서버가 응답을 반환한 경우
        errorMessage =
          error.response.data?.detail ||
          error.response.data?.message ||
          "아이디 또는 비밀번호가 올바르지 않습니다.";
      } else if (error.request) {
        // 요청은 보냈지만 응답이 없는 경우
        errorMessage = "서버에 연결할 수 없습니다.";
      }

      setLoginError(errorMessage);
      console.log("[LoginPage v2] 에러 메시지 설정:", errorMessage);
    } finally {
      setIsLoading(false);
      console.log("[LoginPage v2] 로딩 상태 해제");
    }
  };

  return (
    <div className="min-h-screen br-brand-main">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 py-12">
        <Card className="w-full max-w-lg border-gray-200 bg-white/95 p-8 shadow">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">로그인</h1>
            <p className="mt-1 text-sm text-gray-500">
              가입하신 아이디와 비밀번호를 입력해 주세요.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                아이디
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (loginError) setLoginError("");
                  }}
                  placeholder="아이디를 입력해주세요"
                  className={`h-11 pl-10 ${
                    loginError
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/50"
                      : ""
                  }`}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                비밀번호
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 h-4 w-4 text-gray-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (loginError) setLoginError("");
                  }}
                  placeholder="••••••••"
                  className={`h-11 pl-10 pr-10 ${
                    loginError
                      ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/50"
                      : ""
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 text-gray-400">
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {loginError && (
                <p className="mt-1 text-sm text-red-500">{loginError}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(value) => setRememberMe(Boolean(value))}
                />
                <label htmlFor="remember" className="cursor-pointer">
                  로그인 상태 유지
                </label>
              </div>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700"
                onClick={() =>
                  toast.info("비밀번호 찾기 기능은 준비 중입니다.")
                }>
                비밀번호를 잊으셨나요?
              </button>
            </div>

            <Button
              type="submit"
              className="h-11 w-full bg-gray-900 text-white hover:bg-black"
              disabled={isLoading}>
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>

          <Separator className="my-6" />

          <div className="space-y-3">
            <Button
              variant="outline"
              className="h-11 w-full gap-2"
              onClick={() => toast.info("카카오 로그인은 준비 중입니다.")}>
              카카오로 시작하기
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full gap-2"
              onClick={() => toast.info("네이버 로그인은 준비 중입니다.")}>
              네이버로 시작하기
            </Button>
          </div>

          <Separator className="my-6" />

          <div className="text-center text-sm text-gray-600">
            아직 계정이 없으신가요?{" "}
            <button
              type="button"
              className="font-medium text-gray-900 underline"
              onClick={() => navigate("/signup", { state: { email } })}>
              회원가입
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
