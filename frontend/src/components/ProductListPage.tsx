import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Loader2, RefreshCw, Sparkles, Star } from "lucide-react";

import { useAppState } from "../context/app-state";
import type { Product } from "../types";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { cn } from "./ui/utils";

type FetchStatus = "idle" | "loading" | "error";

const PAGE_SIZE = 20;

export function ProductListPage() {
  const navigate = useNavigate();
  const {
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
  } = useAppState();

  const [sortBy, setSortBy] = useState("popular");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200000]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchProducts = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort: sortBy,
        minPrice: String(priceRange[0]),
        maxPrice: String(priceRange[1]),
      });

      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      if (selectedCategory && selectedCategory !== "all") {
        params.set("category", selectedCategory);
      }
      if (selectedBrands.length > 0) {
        params.set("brands", selectedBrands.join(","));
      }

      const response = await fetch(
        `/api/products/search?${params.toString()}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const data = await response.json();
      const items: Product[] = Array.isArray(data.items)
        ? data.items
        : [];

      setProducts(items);
      setStatus("idle");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected error occurred.",
      );
    }
  }, [
    page,
    priceRange,
    searchQuery,
    selectedBrands,
    selectedCategory,
    sortBy,
  ]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    products.forEach((product) => {
      if (product.category) {
        unique.add(product.category);
      }
    });
    return Array.from(unique).sort();
  }, [products]);

  const brands = useMemo(() => {
    const unique = new Set<string>();
    products.forEach((product) => {
      if (product.brand) {
        unique.add(product.brand);
      }
    });
    return Array.from(unique).sort();
  }, [products]);

  const sortedProducts = useMemo(() => {
    if (status !== "idle") return [];
    const next = [...products];
    switch (sortBy) {
      case "latest":
        return next.sort((a, b) =>
          (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
        );
      case "price-low":
        return next.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      case "price-high":
        return next.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      case "rating":
        return next.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      default:
        return next.sort(
          (a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
        );
    }
  }, [products, sortBy, status]);

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand)
        ? prev.filter((item) => item !== brand)
        : [...prev, brand],
    );
  };

  const handleResetFilters = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    setSelectedBrands([]);
    setPriceRange([0, 200000]);
    setPage(1);
  };

  const handleProductClick = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  return (
    <div className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-gray-500">
              {searchQuery ? (
                <>
                  <span className="font-semibold text-gray-900">
                    "{searchQuery}"
                  </span>{" "}
                  search results
                </>
              ) : (
                "Check out our recommended products."
              )}
            </p>
            {selectedCategory !== "all" && selectedCategory && (
              <p className="text-xs text-gray-400">
                Active category: {selectedCategory}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((prev) => !prev)}
              className="h-9 w-[120px] md:hidden"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
            <Select
              value={sortBy}
              onValueChange={(value) => {
                setSortBy(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Popular</SelectItem>
                <SelectItem value="latest">Newest</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:gap-12">
          <Card
            className={cn(
              "w-full md:w-64 shrink-0 border-gray-200",
              showFilters ? "block" : "hidden md:block",
            )}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                Reset
              </Button>
            </div>

            <div className="space-y-6 px-5 py-5">
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Sparkles className="h-4 w-4" />
                  Category
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="all-category"
                      checked={selectedCategory === "all"}
                      onCheckedChange={() => setSelectedCategory("all")}
                    />
                    <label
                      htmlFor="all-category"
                      className="cursor-pointer text-sm"
                    >
                      All
                    </label>
                  </div>
                  {categories.length > 0 ? (
                    categories.map((category) => (
                      <div key={category} className="flex items-center">
                        <Checkbox
                          id={`cat-${category}`}
                          checked={selectedCategory === category}
                          onCheckedChange={() => setSelectedCategory(category)}
                        />
                        <label
                          htmlFor={`cat-${category}`}
                          className="ml-2 cursor-pointer text-sm"
                        >
                          {category}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400">
                      No categories available.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-medium text-gray-900">
                  Brand
                </h4>
                <div className="space-y-2">
                  {brands.length > 0 ? (
                    brands.map((brand) => (
                      <div key={brand} className="flex items-center">
                        <Checkbox
                          id={`brand-${brand}`}
                          checked={selectedBrands.includes(brand)}
                          onCheckedChange={() => toggleBrand(brand)}
                        />
                        <label
                          htmlFor={`brand-${brand}`}
                          className="ml-2 cursor-pointer text-sm"
                        >
                          {brand}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400">
                      No brands available.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-medium text-gray-900">Price</h4>
                <Slider
                  value={priceRange}
                  onValueChange={(next) => {
                    setPriceRange(next as [number, number]);
                    setPage(1);
                  }}
                  min={0}
                  max={200000}
                  step={10000}
                  className="mb-3"
                />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{priceRange[0].toLocaleString()} KRW</span>
                  <span>{priceRange[1].toLocaleString()} KRW</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex-1">
            {status === "loading" ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin" />
                Loading products...
              </div>
            ) : status === "error" ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-500">
                <p>Failed to fetch products.</p>
                {errorMessage && (
                  <p className="text-xs text-red-400">{errorMessage}</p>
                )}
                <Button variant="outline" onClick={fetchProducts}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-gray-400">No products found.</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/")}
                >
                  Go to home
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortedProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="group cursor-pointer overflow-hidden rounded border border-gray-200 text-left transition hover:shadow-lg"
                    onClick={() => handleProductClick(product.id)}
                  >
                    <div className="relative aspect-square overflow-hidden bg-gray-50">
                      <ImageWithFallback
                        src={product.image ?? ""}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {product.originalPrice &&
                        product.originalPrice > (product.price ?? 0) && (
                          <Badge className="absolute left-2 top-2 border-0 bg-red-500 text-xs text-white">
                            {Math.round(
                              (1 - (product.price ?? 0) / product.originalPrice) *
                                100,
                            )}
                            %
                          </Badge>
                        )}
                    </div>
                    <div className="space-y-2 p-4">
                      {product.brand && (
                        <p className="text-xs text-gray-500">{product.brand}</p>
                      )}
                      <p className="line-clamp-2 h-10 text-sm text-gray-900">
                        {product.name}
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-semibold text-gray-900">
                          {(product.price ?? 0).toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-500">KRW</span>
                      </div>
                      {product.originalPrice &&
                        product.originalPrice > (product.price ?? 0) && (
                          <p className="text-xs text-gray-400 line-through">
                            {product.originalPrice.toLocaleString()} KRW
                          </p>
                        )}
                      {(product.rating ?? 0) > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Star className="h-3 w-3 fill-gray-900 text-gray-900" />
                          <span>{(product.rating ?? 0).toFixed(1)}</span>
                          {product.reviewCount !== undefined && (
                            <span className="text-gray-400">
                              ({product.reviewCount.toLocaleString()})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
