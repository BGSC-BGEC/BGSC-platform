import * as React from "react"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean | "indeterminate"
  onCheckedChange?: (checked: boolean) => void
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => {
    const isIndeterminate = checked === "indeterminate"
    const isChecked = checked === true

    const handleClick = () => {
      if (disabled) return
      onCheckedChange?.(!isChecked)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        onCheckedChange?.(!isChecked)
      }
    }

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={isIndeterminate ? "mixed" : isChecked}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-xs border border-border bg-background shadow-xs transition-colors",
          "flex items-center justify-center text-current",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          (isChecked || isIndeterminate) && "bg-primary border-primary text-primary-foreground",
          className
        )}
        {...props}
      >
        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
        {isIndeterminate && <Minus className="h-3 w-3 stroke-[3]" />}
      </button>
    )
  }
)
Checkbox.displayName = "Checkbox"
