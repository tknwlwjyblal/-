interface Props {
  emoji: string;
  gradient: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: "text-5xl",
  md: "text-7xl",
  lg: "text-8xl",
  xl: "text-9xl",
};

export default function ProductImage({ emoji, gradient, size = "md", className = "" }: Props) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${gradient} ${className}`}
    >
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1.2px, transparent 0)",
          backgroundSize: "20px 20px",
        }}
      />
      <div className="absolute -bottom-10 -start-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
      <div className="absolute -top-10 -end-10 h-40 w-40 rounded-full bg-black/10 blur-2xl" />
      <span
        className={`relative select-none drop-shadow-[0_10px_16px_rgba(0,0,0,0.3)] transition-transform duration-300 group-hover:scale-110 ${sizes[size]}`}
      >
        {emoji}
      </span>
    </div>
  );
}
