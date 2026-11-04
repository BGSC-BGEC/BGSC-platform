import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectContextType {
  value?: string
  onValueChange?: (value: string) => void
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  labels: Record<string, React.ReactNode>
  registerLabel: (value: string, label: React.ReactNode) => void
}

const SelectContext = React.createContext<SelectContextType | null>(null)

export interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export function Select({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  open: controlledOpen,
  onOpenChange,
  children,
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [labels, setLabels] = React.useState<Record<string, React.ReactNode>>({})

  const isControlledValue = controlledValue !== undefined
  const value = isControlledValue ? controlledValue : uncontrolledValue

  const isControlledOpen = controlledOpen !== undefined
  const open = isControlledOpen ? controlledOpen : uncontrolledOpen

  const setOpen = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (action) => {
      const next = typeof action === "function" ? action(open) : action
      if (!isControlledOpen) {
        setUncontrolledOpen(next)
      }
      onOpenChange?.(next)
    },
    [isControlledOpen, onOpenChange, open]
  )

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (!isControlledValue) {
        setUncontrolledValue(newValue)
      }
      onValueChange?.(newValue)
      setOpen(false)
    },
    [isControlledValue, onValueChange, setOpen]
  )

  const registerLabel = React.useCallback((val: string, label: React.ReactNode) => {
    setLabels((prev) => (prev[val] === label ? prev : { ...prev, [val]: label }))
  }, [])

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: handleValueChange,
        open,
        setOpen,
        labels,
        registerLabel,
      }}
    >
      <div className="relative inline-block text-left">{children}</div>
    </SelectContext.Provider>
  )
}

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error("SelectTrigger must be used within Select")

  return (
    <button
      ref={ref}
      type="button"
      role="combobox"
      aria-expanded={context.open}
      onClick={() => context.setOpen((prev) => !prev)}
      className={cn(
        "flex h-9 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

export interface SelectValueProps {
  placeholder?: string
  className?: string
}

export function SelectValue({ placeholder = "Select...", className }: SelectValueProps) {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error("SelectValue must be used within Select")

  const display = context.value ? context.labels[context.value] ?? context.value : placeholder

  return (
    <span className={cn("block truncate text-foreground", className)}>
      {display}
    </span>
  )
}

export const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useImperativeHandle(ref, () => containerRef.current!)

  React.useEffect(() => {
    if (!context?.open) return

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        context?.setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        context?.setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [context])

  if (!context?.open) return null

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute z-50 mt-1 min-w-[8rem] max-h-60 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
SelectContent.displayName = "SelectContent"

export interface SelectItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export const SelectItem = React.forwardRef<HTMLButtonElement, SelectItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(SelectContext)
    if (!context) throw new Error("SelectItem must be used within Select")

    const isSelected = context.value === value

    React.useEffect(() => {
      context.registerLabel(value, children)
    }, [value, children, context])

    return (
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={() => context.onValueChange?.(value)}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 ps-2 pe-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          isSelected && "bg-accent/60 font-medium",
          className
        )}
        {...props}
      >
        <span className="truncate">{children}</span>
        {isSelected && (
          <span className="absolute end-2 flex h-3.5 w-3.5 items-center justify-center">
            <Check className="h-4 w-4" />
          </span>
        )}
      </button>
    )
  }
)
SelectItem.displayName = "SelectItem"
