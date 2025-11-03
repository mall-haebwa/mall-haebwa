import { useEffect, useRef, useState } from "react";
import { Sparkles, Search, TrendingUp, Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const EXAMPLE_SEARCHES = [
  "다가오는 휴가를 위한 수영복 추천",
  "홈 오피스를 감각 있게 꾸미고 싶어요",
  "부모님 선물로 좋은 건강식품 알려줘",
  "최신 게임용 노트북 뭐가 좋아?",
  "겨울 아우터 트렌드가 궁금해",
  "마라톤 입문자를 위한 러닝화 찾아줘",
];

export function AISearchPage() {
  const [searchInput, setSearchInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isChatting = messages.length > 0;

  const handleSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) {
      return;
    }
    console.log("AI search query:", trimmed);

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setSearchInput("");
    setIsLoading(true);

    try {
      // 실제 LM Studio API 호출
      const response = await fetch("/api/test-llm-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!response.ok) {
        throw new Error("AI 응답 실패");
      }

      const data = await response.json();
      const assistantReply: ChatMessage = {
        role: "assistant",
        content: data.ai_response || "응답을 받지 못했습니다.",
      };
      setMessages((prev) => [...prev, assistantReply]);
    } catch (error) {
      console.error("AI 검색 오류:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content:
          "죄송합니다. AI 응답을 가져오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setSearchInput(example);
    handleSearch(example);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-purple-50 via-pink-50 to-white">
      <div
        className={`mx-auto flex h-full max-w-[1280px] flex-col items-center px-6 py-12 md:px-8 ${
          isChatting ? "justify-start" : "justify-center"
        }`}
      >
        <header className="text-center">
          <h1 className="mb-4 text-3xl font-semibold text-gray-900 md:text-4xl">
            AI 쇼핑 도우미
          </h1>
          <p className="mb-10 text-base text-gray-600 md:text-lg">
            찾고 싶은 제품이나 고민을 자유롭게 이야기하면 AI가 맞춤 추천을
            도와드릴게요.
          </p>
        </header>

        {!isChatting && (
          <section className="mx-auto mb-10 w-full max-w-4xl">
            <div className="mb-6 flex w-full items-center gap-3 rounded-full border-2 border-purple-200 bg-white px-4 py-2 shadow-sm">
              <Input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch(searchInput);
                  }
                }}
                className="h-12 flex-1 border-none bg-transparent text-base focus-visible:ring-0"
                placeholder="무엇이든 물어보세요"
              />
              <Button
                onClick={() => handleSearch(searchInput)}
                disabled={isLoading}
                className="h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-6 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                검색
              </Button>
            </div>

            <div>
              <div className="mb-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                <TrendingUp className="h-4 w-4" />
                <span>요즘 이런 질문이 많아요</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_SEARCHES.map((example) => (
                  <button
                    key={example}
                    onClick={() => handleExampleClick(example)}
                    className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs text-gray-700 transition-colors hover:border-purple-300 hover:bg-purple-50 md:text-sm"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {isChatting && (
          <section className="mx-auto mb-6 flex w-full max-w-4xl flex-1 flex-col">
            <div
              ref={chatScrollRef}
              className="flex flex-1 flex-col gap-4 overflow-y-auto rounded-3xl border border-purple-100 bg-white/90 p-6 shadow-lg backdrop-blur"
            >
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm md:text-base ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : "bg-white text-gray-800 shadow-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl bg-white px-4 py-3 text-sm shadow-md md:text-base">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>AI가 답변을 생성하고 있습니다...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="sticky bottom-0 mt-4 w-full rounded-3xl border border-purple-200 bg-white p-3 shadow-lg">
              <div className="flex items-center gap-3">
                <Input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSearch(searchInput);
                    }
                  }}
                  className="h-12 flex-1 border-none bg-transparent text-base focus-visible:ring-0"
                  placeholder="이어서 궁금한 내용을 입력하세요"
                />
                <Button
                  onClick={() => handleSearch(searchInput)}
                  disabled={isLoading}
                  className="h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-6 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  전송
                </Button>
              </div>
            </div>
          </section>
        )}

        {!isChatting && (
          <section className="grid w-full max-w-4xl gap-6 text-sm text-gray-600 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <Sparkles className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-gray-900">
                맥락 이해 검색
              </h3>
              <p>
                상황과 취향을 함께 알려주면 AI가 의도를 이해하고 맞춤형 제품을
                찾아드려요.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pink-100">
                <Search className="h-6 w-6 text-pink-500" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-gray-900">
                섬세한 추천
              </h3>
              <p>
                가격대, 취향, 선호 브랜드 등 원하는 조건을 조합해 세밀한 추천을
                받아보세요.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <TrendingUp className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-gray-900">
                트렌드 분석
              </h3>
              <p>
                지금 인기 있는 제품, 리뷰 키워드, 관련 질문 등 최신 데이터를
                기반으로 인사이트를 제공합니다.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
