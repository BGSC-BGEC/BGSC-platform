import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      type = "button",
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      default:
        "bg-primary text-primary-foreground shadow hover:opacity-90 active:scale-[0.98]",
      destructive:
        "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90 active:scale-[0.98]",
      outline:
        "border border-border bg-background shadow-xs hover:bg-muted hover:text-foreground active:scale-[0.98]",
      secondary:
        "bg-secondary text-secondary-foreground shadow-xs hover:opacity-80 active:scale-[0.98]",
      ghost:
        "hover:bg-muted hover:text-foreground active:scale-[0.98]",
      link: "text-primary underline-offset-4 hover:underline",
    }[variant]

    const sizeStyles = {
      default: "h-9 px-4 py-2 text-sm",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-8 text-base",
      icon: "h-9 w-9 p-0",
    }[size]

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          variantStyles,
          sizeStyles,
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
