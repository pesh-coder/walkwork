import clsx from "clsx";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "light" | "dark" | "teal";
  className?: string;
}

export function Logo({ size = "md", variant = "dark", className }: LogoProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
    xl: "text-6xl",
  }[size];

  const dotSize = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-3 h-3",
    xl: "w-4 h-4",
  }[size];

  const textColor =
    variant === "light"
      ? "text-sand-50"
      : variant === "teal"
      ? "text-teal-700"
      : "text-ink-900";

  // Coral dot on dark/teal headers, coral on light too — the accent stays consistent
  const dotColor = "bg-coral-500";

  return (
    <div
      className={clsx(
        "inline-flex items-baseline gap-1.5 font-display font-semibold tracking-tight",
        textColor,
        sizeClasses,
        className
      )}
    >
      <span>tukole</span>
      <span className={clsx(dotSize, dotColor, "rounded-sm translate-y-[1px]")} />
    </div>
  );
}
