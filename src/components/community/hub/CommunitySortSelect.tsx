import { useMemo } from "react";
import { Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProductSortKey =
  | "newest"
  | "best_selling"
  | "resin"
  | "filament"
  | "price_low"
  | "price_high"
  | "alpha_asc"
  | "alpha_desc";

export type RequestSortKey = "newest" | "not_priced" | "resin" | "filament";

export type MerchantSortKey = "newest" | "filament_specialist" | "resin_specialist" | "verified";

type ProductProps = {
  type: "products";
  value: ProductSortKey;
  onChange: (v: ProductSortKey) => void;
  isMerchant?: boolean;
};

type RequestProps = {
  type: "requests";
  value: RequestSortKey;
  onChange: (v: RequestSortKey) => void;
  isMerchant?: boolean;
};

type MerchantProps = {
  type: "merchants";
  value: MerchantSortKey;
  onChange: (v: MerchantSortKey) => void;
  isMerchant?: boolean;
};

type Props = ProductProps | RequestProps | MerchantProps;

const productOptions: { value: ProductSortKey; label: string }[] = [
  { value: "newest", label: "الأحدث" },
  { value: "best_selling", label: "الأفضل مبيعاً" },
  { value: "resin", label: "رزن" },
  { value: "filament", label: "فلمنت" },
  { value: "price_low", label: "أقل سعر" },
  { value: "price_high", label: "أعلى سعر" },
  { value: "alpha_asc", label: "أ - ي" },
  { value: "alpha_desc", label: "ي - أ" },
];

const requestOptions: { value: RequestSortKey; label: string; merchantOnly?: boolean }[] = [
  { value: "newest", label: "الأحدث" },
  { value: "not_priced", label: "لم يتم تسعيره", merchantOnly: true },
  { value: "resin", label: "رزن" },
  { value: "filament", label: "فلمنت" },
];

const merchantOptions: { value: MerchantSortKey; label: string }[] = [
  { value: "newest", label: "الأحدث" },
  { value: "filament_specialist", label: "متخصص فلمنت" },
  { value: "resin_specialist", label: "متخصص رزن" },
  { value: "verified", label: "الموثوق" },
];

export function CommunitySortSelect(props: Props) {
  const { type, value, onChange, isMerchant = false } = props;

  const options = useMemo(() => {
    if (type === "products") return productOptions;
    if (type === "requests") {
      return requestOptions.filter((o) => !o.merchantOnly || isMerchant);
    }
    return merchantOptions;
  }, [type, isMerchant]);

  const handleChange = (v: string) => {
    if (type === "products") {
      (onChange as (v: ProductSortKey) => void)(v as ProductSortKey);
    } else if (type === "requests") {
      (onChange as (v: RequestSortKey) => void)(v as RequestSortKey);
    } else {
      (onChange as (v: MerchantSortKey) => void)(v as MerchantSortKey);
    }
  };

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="h-7 w-auto min-w-[90px] text-[10px] rounded-lg border-border/60 bg-card/80 backdrop-blur-sm gap-1 px-2">
        <Filter className="h-2.5 w-2.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[120px]">
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className="text-[10px] py-1"
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
