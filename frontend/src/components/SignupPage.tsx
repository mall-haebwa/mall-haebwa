import { useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function SignupPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreements, setAgreements] = useState({
    terms: true,
    privacy: true,
    marketing: false,
  });
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    phone: "",
    address: "",
  });

  const toggleAgreement = (key: keyof typeof agreements) => {
    setAgreements((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.email || !form.password || !form.confirmPassword || !form.name) {
      toast.error("필수 정보를 모두 입력해 주세요.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!agreements.terms || !agreements.privacy) {
      toast.error("필수 약관에 동의해 주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/auth/register`,
        {
          email: form.email,
          password: form.password,
          name: form.name,
          phone: form.phone || undefined,
          address: form.address || undefined,
        },
        {
          withCredentials: true, // 쿠키 허용 시 필요
        }
      );

      toast.success(response.data.message || "가입이 완료되었습니다.");
      navigate("/login", { state: { email: form.email } });
    } catch (error: any) {
      console.error("Signup error:", error);
      const errorMessage =
        error.response?.data?.detail || "회원가입 중 오류가 발생했습니다.";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-12">
        <Card className="w-full border-gray-200 bg-white/95 p-8 shadow">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">회원가입</h1>
            <p className="mt-1 text-sm text-gray-500">
              Mall 해봐의 다양한 혜택을 받아보세요.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  이메일
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      handleChange("email", event.target.value)
                    }
                    placeholder="you@example.com"
                    className="h-11 pl-10"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  이름
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      handleChange("name", event.target.value)
                    }
                    placeholder="홍길동"
                    className="h-11 pl-10"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  비밀번호
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) =>
                      handleChange("password", event.target.value)
                    }
                    placeholder="8자 이상 입력해 주세요"
                    className="h-11 pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    onClick={() => setShowPassword((prev) => !prev)}>
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  비밀번호 확인
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={(event) =>
                      handleChange("confirmPassword", event.target.value)
                    }
                    placeholder="비밀번호를 다시 입력해 주세요"
                    className="h-11 pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}>
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  휴대폰 번호
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={form.phone}
                    onChange={(event) =>
                      handleChange("phone", event.target.value)
                    }
                    placeholder="010-1234-5678"
                    className="h-11 pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  주소
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={form.address}
                    onChange={(event) =>
                      handleChange("address", event.target.value)
                    }
                    placeholder="서울특별시 강남구"
                    className="h-11 pl-10"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="agree-all"
                  checked={
                    agreements.terms &&
                    agreements.privacy &&
                    agreements.marketing
                  }
                  onCheckedChange={(value) => {
                    const checked = Boolean(value);
                    setAgreements({
                      terms: checked,
                      privacy: checked,
                      marketing: checked,
                    });
                  }}
                />
                <label
                  htmlFor="agree-all"
                  className="cursor-pointer font-medium text-gray-900">
                  전체 동의
                </label>
              </div>
              <div className="ml-6 space-y-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={agreements.terms}
                    onCheckedChange={() => toggleAgreement("terms")}
                  />
                  <span>[필수] 이용약관 동의</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={agreements.privacy}
                    onCheckedChange={() => toggleAgreement("privacy")}
                  />
                  <span>[필수] 개인정보 수집 및 이용 동의</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={agreements.marketing}
                    onCheckedChange={() => toggleAgreement("marketing")}
                  />
                  <span>[선택] 마케팅 정보 수신 동의</span>
                </label>
              </div>
            </div>

            <Button
              type="submit"
              className="h-11 w-full bg-gray-900 text-white hover:bg-black"
              disabled={isLoading}>
              {isLoading ? "가입 처리 중..." : "가입 완료"}
            </Button>
          </form>

          <Separator className="my-6" />

          <div className="text-center text-sm text-gray-600">
            이미 계정이 있으신가요?{" "}
            <button
              type="button"
              className="font-medium text-gray-900 underline"
              onClick={() => navigate("/login")}>
              로그인
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
