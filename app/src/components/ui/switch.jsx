import { cn } from "@/lib/utils";

/**
 * 设计系统开关。仅使用设计系统颜色，无 Radix 依赖。
 */
function Switch({ className, checked, onCheckedChange, disabled, ...props }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 shrink-0 rounded-full bg-background shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out dark:ring-white/10",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export { Switch };
