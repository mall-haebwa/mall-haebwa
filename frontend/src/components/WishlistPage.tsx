import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ShoppingBag, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "../context/app-state";
import type { WishlistItem } from "../types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Separator } from "./ui/separator";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function WishlistPage() {
    const navigate = useNavigate();
    const { addToCart } = useAppState();
    const [items, setItems] = useState<WishlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItems, setSelectedItems] = useState<number[]>([]);

    useEffect(() => {
        loadWishlist();
    }, []);

    useEffect(() => {
        // 아이템이 변경되면 선택 상태 조정
        setSelectedItems((prev) => prev.filter((index) => index < items.length));
    }, [items]);

    const loadWishlist = async () => {
        try {
        const res = await fetch("/api/wishlist/list", {
            credentials: "include",
        });

        if (!res.ok) {
            const error = await res.json();
            if (error.detail?.includes("로그인")) {
            toast.error("로그인이 필요합니다.");
            navigate("/login");
            return;
            }
            throw new Error(error.detail || "찜 목록 조회 실패");
        }

        const data = await res.json();
        setItems(data.items || []);
        } catch (error: any) {
        toast.error(error.message || "찜 목록을 불러올 수 없습니다.");
        } finally {
        setLoading(false);
        }
    };

    const handleRemove = async (productId: string) => {
        try {
        const res = await fetch(`/api/wishlist/remove/${productId}`, {
            method: "DELETE",
            credentials: "include",
        });

        if (!res.ok) throw new Error("찜 제거 실패");

        setItems((prev) => prev.filter((item) => item.product.id !== productId));
        toast.success("찜 목록에서 제거되었습니다.");
        } catch (error: any) {
        toast.error(error.message || "오류가 발생했습니다.");
        }
    };

    const toggleItem = (index: number) => {
        setSelectedItems((prev) =>
        prev.includes(index)
            ? prev.filter((value) => value !== index)
            : [...prev, index]
        );
    };

    const toggleAll = () => {
        if (selectedItems.length === items.length) {
        setSelectedItems([]);
        } else {
        setSelectedItems(items.map((_, index) => index));
        }
    };

    const handleRemoveSelected = async () => {
        if (selectedItems.length === 0) return;

        try {
        // 선택된 항목들을 역순으로 삭제 (인덱스 꼬임 방지)
        const selectedProducts = selectedItems
            .map((index) => items[index])
            .filter(Boolean);

        for (const item of selectedProducts) {
            await fetch(`/api/wishlist/remove/${item.product.id}`, {
            method: "DELETE",
            credentials: "include",
            });
        }

        setItems((prev) =>
            prev.filter((_, index) => !selectedItems.includes(index))
        );
        setSelectedItems([]);
        toast.success("선택한 항목이 제거되었습니다.");
        } catch (error: any) {
        toast.error("일부 항목 제거에 실패했습니다.");
        }
    };

    const handleAddToCart = (item: WishlistItem) => {
    addToCart({
        productId: item.product.id,  // ✅ productId 추가!
        product: item.product,
        quantity: 1,
        selectedColor: undefined,
        selectedSize: undefined,
    });
    toast.success("장바구니에 추가되었습니다.", {
        action: {
        label: "장바구니 보기",
        onClick: () => navigate("/cart"),
        },
    });
    };

    if (loading) {
        return (
        <div className="flex min-h-[400px] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-sm text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>찜 목록을 불러오는 중입니다…</span>
            </div>
        </div>
        );
    }

    if (items.length === 0) {
        return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto flex max-w-[1280px] flex-col items-center px-6 py-20 text-center md:px-8">
            <Heart className="mb-4 h-16 w-16 text-gray-300" />
            <h2 className="mb-2 text-xl font-semibold text-gray-900">
                찜한 상품이 없습니다
            </h2>
            <p className="mb-6 text-sm text-gray-600">
                마음에 드는 상품을 찜해보세요.
            </p>
            <Button
                onClick={() => navigate("/products")}
                className="h-10 bg-gray-900 text-white hover:bg-black"
            >
                상품 둘러보기
            </Button>
            </div>
        </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-[1280px] px-6 py-6 md:px-8">
            <h1 className="mb-6 text-2xl font-semibold text-gray-900">
            Wish List
            </h1>

            <Card className="border-gray-200 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-700">
                <Checkbox
                checked={selectedItems.length === items.length}
                onCheckedChange={toggleAll}
                />
                <span>
                Select all ({selectedItems.length}/{items.length})
                </span>
                <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs"
                disabled={selectedItems.length === 0}
                onClick={handleRemoveSelected}
                >
                Remove selected
                </Button>
            </div>

            <Separator className="mb-4" />

            <div className="space-y-4">
                {items.map((item, index) => (
                <div
                    key={item.wishlist_id}
                    className="flex gap-4 border border-gray-200 p-4"
                >
                    <Checkbox
                    checked={selectedItems.includes(index)}
                    onCheckedChange={() => toggleItem(index)}
                    />
                    <div className="h-20 w-20 shrink-0 overflow-hidden border border-gray-200">
                    <ImageWithFallback
                        src={item.product.image}
                        alt={item.product.name}
                        className="h-full w-full object-cover"
                    />
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                    <div>
                        <h3
                        className="cursor-pointer text-m font-medium text-gray-900 
    hover:text-gray-600"
                        onClick={() => navigate(`/product/${item.product.id}`)}
                        >
                        {item.product.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                        {item.product.brand}
                        </p>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                        <span className="text-m font-semibold text-gray-900">
                            ₩{item.product.price.toLocaleString()}
                        </span>
                        {item.product.originalPrice && (
                            <span className="text-xs text-gray-400 line-through">
                            ₩{item.product.originalPrice.toLocaleString()}
                            </span>
                        )}
                        </div>
                        <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => handleAddToCart(item)}
                        >
                            <ShoppingBag className="h-3 w-3" />
                            Shopping Cart +
                        </Button>
                        <button
                            type="button"
                            className="flex items-center gap-1 text-xs text-gray-500 
    hover:text-red-500"
                            onClick={() => handleRemove(item.product.id)}
                        >
                            <Trash2 className="h-3 w-3" />
                            Remove
                        </button>
                        </div>
                    </div>
                    </div>
                </div>
                ))}
            </div>
            </Card>
        </div>
        </div>
    );
}