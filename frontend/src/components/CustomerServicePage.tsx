import { useState } from "react";
import {
  ChevronDown,
  Clock,
  FileText,
  HelpCircle,
  Mail,
  MessageSquare,
  Package,
  Phone,
  RotateCcw,
  Send,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";

const faqData = [
  {
    category: "주문/결제",
    items: [
      {
        question: "주문 내역은 어디에서 확인하나요?",
        answer:
          "마이페이지 > 주문 내역에서 최근 주문 상태를 확인할 수 있습니다.",
      },
      {
        question: "무통장 입금 기한은 언제까지인가요?",
        answer: "주문일 기준 3일 이내 입금하지 않으면 자동으로 취소됩니다.",
      },
    ],
  },
  {
    category: "배송",
    items: [
      {
        question: "배송은 얼마나 걸리나요?",
        answer:
          "기본 배송은 2~3일, 당일배송 상품은 주문일 기준 다음날 도착합니다.",
      },
      {
        question: "배송 상태가 '배송 준비중'에서 멈춰 있어요.",
        answer:
          "물류센터에서 출고 준비 중입니다. 1일 이상 지연 시 고객센터로 문의해 주세요.",
      },
    ],
  },
  {
    category: "반품/환불",
    items: [
      {
        question: "반품 신청은 어떻게 하나요?",
        answer:
          "주문 내역에서 반품 신청 버튼을 눌러 사유와 사진을 등록해 주세요.",
      },
      {
        question: "환불은 언제 처리되나요?",
        answer: "상품 회수 후 3~5일 이내 결제 수단으로 환불됩니다.",
      },
    ],
  },
];

export function CustomerServicePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("faq");
  const [questionType, setQuestionType] = useState("order");

  const handleSubmitInquiry = (event: React.FormEvent) => {
    event.preventDefault();
    toast.success("문의가 접수되었습니다. 빠른 시일 내 답변 드릴게요.");
  };

  return (
    <div className="min-h-screen bg-brand-main">
      <div className="mx-auto max-w-[1100px] px-6 py-10 md:px-8">
        <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">고객센터</h1>
            <p className="text-sm text-gray-600">
              자주 묻는 질문을 확인하거나 1:1 문의를 남겨 주세요.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 text-sm bg-brand-main"
            onClick={() => navigate("/")}>
            홈으로 이동
            <ChevronDown className="-rotate-90 transform" />
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="border-gray-200 p-6 bg-brand-main">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="faq">자주 묻는 질문</TabsTrigger>
                <TabsTrigger value="inquiry">1:1 문의</TabsTrigger>
              </TabsList>

              <TabsContent value="faq" className="mt-6 space-y-6">
                {faqData.map((section) => (
                  <div key={section.category}>
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <HelpCircle className="h-4 w-4 text-gray-500" />
                      {section.category}
                    </h2>
                    <Accordion type="single" collapsible>
                      {section.items.map((item) => (
                        <AccordionItem
                          key={item.question}
                          value={item.question}>
                          <AccordionTrigger className="text-left text-sm font-medium text-gray-800">
                            {item.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-gray-600">
                            {item.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="inquiry" className="mt-6">
                <form onSubmit={handleSubmitInquiry} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="email">연락 받을 이메일</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="customer@example.com"
                        className="mt-1.5"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="orderId">주문 번호 (선택)</Label>
                      <Input
                        id="orderId"
                        placeholder="예) ORD-20250101-0001"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="questionType">문의 유형</Label>
                      <Select
                        value={questionType}
                        onValueChange={setQuestionType}>
                        <SelectTrigger id="questionType" className="mt-1.5">
                          <SelectValue placeholder="선택해 주세요" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="order">주문/결제</SelectItem>
                          <SelectItem value="delivery">배송 문의</SelectItem>
                          <SelectItem value="return">반품/환불</SelectItem>
                          <SelectItem value="product">상품 문의</SelectItem>
                          <SelectItem value="etc">기타 문의</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="phone">연락처 (선택)</Label>
                      <Input
                        id="phone"
                        placeholder="예) 010-1234-5678"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="title">제목</Label>
                    <Input
                      id="title"
                      placeholder="문의 제목을 입력해 주세요"
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="content">문의 내용</Label>
                    <Textarea
                      id="content"
                      rows={6}
                      placeholder="상세한 내용을 작성해 주시면 보다 빠르게 도와드릴 수 있어요."
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="h-11 w-full gap-2 bg-gray-900 text-white hover:bg-black md:w-auto">
                    <Send className="h-4 w-4" />
                    문의 등록
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </Card>

          <div className="space-y-4">
            <Card className="space-y-4 border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-500" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    전화 상담
                  </h3>
                  <p className="text-xs text-gray-500">
                    평일 09:00 ~ 18:00 (점심 12:00 ~ 13:00)
                  </p>
                </div>
              </div>
              <p className="text-lg font-semibold text-gray-900">1666-1234</p>
            </Card>

            <Card className="space-y-4 border-gray-200 p-6 bg-brand-main">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-500" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    이메일 문의
                  </h3>
                  <p className="text-xs text-gray-500">
                    24시간 접수 / 영업일 기준 24시간 이내 답변
                  </p>
                </div>
              </div>
              <p className="font-mono text-sm text-gray-700">
                support@mall-haebwa.com
              </p>
            </Card>

            <Card className="space-y-3 border-gray-200 p-6 bg-brand-main text-sm text-gray-600">
              <div className="flex items-center gap-2 text-gray-900">
                <MessageSquare className="h-4 w-4" />
                실시간 채팅
              </div>
              <p>평일 09:00 ~ 18:00, 모바일 앱에서 실시간 상담이 가능합니다.</p>
            </Card>

            <Card className="space-y-3 border-gray-200 p-6 bg-brand-main text-sm text-gray-600">
              <div className="flex items-center gap-2 text-gray-900">
                <Package className="h-4 w-4" />
                배송 안내
              </div>
              <p>
                오후 2시 이전 결제 완료 시 당일 출고되며, 배송 상태는 주문
                내역에서 확인할 수 있습니다.
              </p>
            </Card>

            <Card className="space-y-3 border-gray-200 p-6 bg-brand-main text-sm text-gray-600">
              <div className="flex items-center gap-2 text-gray-900">
                <RotateCcw className="h-4 w-4" />
                반품/교환 절차
              </div>
              <ol className="list-inside list-decimal space-y-1 text-xs">
                <li>주문 내역에서 반품/교환 신청</li>
                <li>사진 첨부 및 사유 작성</li>
                <li>택배 기사 방문 수거</li>
                <li>검수 완료 후 환불 및 교환 처리</li>
              </ol>
            </Card>

            <Card className="space-y-3 border-gray-200 p-6 bg-brand-main text-sm text-gray-600">
              <div className="flex items-center gap-2 text-gray-900">
                <FileText className="h-4 w-4" />
                공지사항
              </div>
              <ul className="list-disc space-y-1 pl-4 text-xs">
                <li>6월 배송 일정 안내 (6/1 공휴일 휴무)</li>
                <li>여름 시즌 베스트 상품 추천 이벤트</li>
                <li>해외 배송 지역 추가 (미주/유럽)</li>
              </ul>
            </Card>

            <Card className="space-y-3 border-gray-200 p-6 bg-brand-main text-sm text-gray-600">
              <div className="flex items-center gap-2 text-gray-900">
                <Clock className="h-4 w-4" />
                상담 현황
              </div>
              <p>현재 상담 대기 시간은 약 5분입니다.</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
