import clsx from "clsx";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
  className?: string;
}

export function Logo({ size = "md", variant = "dark", className }: LogoProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  }[size];

  const dotSize = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-3 h-3",
  }[size];

  return (
    <div
      className={clsx(
        "inline-flex items-baseline gap-1.5 font-display font-semibold tracking-tight",
        variant === "light" ? "text-cream-50" : "text-ink-900",
        sizeClasses,
        className
      )}
    >
      <span>tukole</span>
      <span className={clsx(dotSize, "bg-terracotta-500 rounded-sm translate-y-[1px]")} />
    </div>
  );
}
