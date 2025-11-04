import {
  ChevronRight,
  Heart,
  LogOut,
  Package,
  Settings,
  Star,
  User as UserIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAppState } from "../context/app-state";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Separator } from "./ui/separator";

const menuItems = [
  {
    icon: Package,
    title: "주문/배송 조회",
    description: "주문 기록과 배송 상태를 확인하세요.",
    path: "/orders",
  },
  {
    icon: Heart,
    title: "찜한 상품",
    description: "관심 있는 상품을 모아보세요.",
    path: "/wishlist",
  },
  {
    icon: Star,
    title: "상품 리뷰",
    description: "작성한 리뷰와 포인트를 확인하세요.",
    path: "/reviews",
  },
  {
    icon: Settings,
    title: "회원 정보 수정",
    description: "비밀번호, 주소 등 정보를 변경하세요.",
    path: "/settings",
  },
];

export function MyPage() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAppState();

  if (!currentUser) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <UserIcon className="h-16 w-16 text-gray-300" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            로그인이 필요합니다
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            로그인하고 주문 내역과 맞춤 추천을 확인해 보세요.
          </p>
        </div>
        <Button
          className="h-11 px-8 bg-gray-900 text-white hover:bg-black"
          onClick={() => navigate("/login")}
        >
          로그인하기
        </Button>
      </div>
    );
  }

  const initials = currentUser.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1100px] px-6 py-10 md:px-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">마이페이지</h1>
            <p className="text-sm text-gray-600">
              주문 내역과 적립금, 배송지 정보를 빠르게 확인하세요.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 text-sm"
            onClick={() => {
              logout();
              toast.success("로그아웃되었습니다.");
              navigate("/");
            }}
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </Button>
        </div>

        <Card className="border-gray-200 p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border border-gray-200">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-gray-500">환영합니다</p>
                <h2 className="text-xl font-semibold text-gray-900">
                  {currentUser.name}님
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {currentUser.email}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center text-sm text-gray-700">
              <div>
                <p className="text-xs text-gray-500">적립금</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  12,500P
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">쿠폰</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  3장
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {menuItems.map(({ icon: Icon, title, description, path }) => (
            <Card
              key={title}
              className="group cursor-pointer border-gray-200 p-5 transition hover:border-gray-300 hover:shadow-md"
              onClick={() => {
                if (path === "/reviews" || path === "/settings") {
                  toast.info("해당 메뉴는 추후 제공될 예정입니다.");
                } else {
                  navigate(path);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{title}</p>
                    <p className="text-xs text-gray-500">{description}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 transition group-hover:text-gray-600" />
              </div>
            </Card>
          ))}
        </div>

        <Separator className="my-8" />

        <Card className="border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">기본 정보</h2>
          <div className="mt-4 grid gap-3 text-sm text-gray-700 md:grid-cols-2">
            <div>
              <p className="text-xs text-gray-500">이름</p>
              <p className="mt-1">{currentUser.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">이메일</p>
              <p className="mt-1">{currentUser.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">전화번호</p>
              <p className="mt-1">{currentUser.phone || "미입력"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">배송지</p>
              <p className="mt-1">{currentUser.address || "미입력"}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
