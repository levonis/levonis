import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatNumberInput, parseFormattedNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface FormattedNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string;
  onChange: (value: number) => void;
  /** Suffix to display after the number (e.g., "د.ع") */
  suffix?: string;
  /** Whether to allow decimal values */
  allowDecimals?: boolean;
}

/**
 * A number input that automatically formats values with thousand separators
 * while maintaining the raw numeric value for form handling.
 * 
 * Example: typing 45097 displays as "45,097"
 */
const FormattedNumberInput = React.forwardRef<HTMLInputElement, FormattedNumberInputProps>(
  ({ className, value, onChange, suffix, allowDecimals = false, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>('');

    // Update display value when external value changes
    React.useEffect(() => {
      const numValue = typeof value === 'string' ? parseFormattedNumber(value) : value;
      if (numValue === 0 || !numValue) {
        setDisplayValue('');
      } else {
        setDisplayValue(formatNumberInput(String(numValue)));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      
      // Allow empty input
      if (!rawValue) {
        setDisplayValue('');
        onChange(0);
        return;
      }

      // Remove non-numeric characters (except decimal if allowed)
      let cleanValue = allowDecimals 
        ? rawValue.replace(/[^0-9.,]/g, '').replace(/,/g, '')
        : rawValue.replace(/[^0-9,]/g, '').replace(/,/g, '');

      // Format with commas
      const formattedValue = formatNumberInput(cleanValue);
      setDisplayValue(formattedValue);

      // Parse and call onChange with numeric value
      const numericValue = parseFormattedNumber(cleanValue);
      onChange(numericValue);
    };

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          className={cn(suffix ? "pl-12" : "", className)}
          dir="ltr"
        />
        {suffix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);

FormattedNumberInput.displayName = "FormattedNumberInput";

export { FormattedNumberInput };
