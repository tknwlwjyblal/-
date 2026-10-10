interface Props {
  rating: number;
  className?: string;
}

export default function Stars({ rating, className = "text-sm" }: Props) {
  const full = Math.round(rating);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? "text-amber-400" : "text-stone-300"}>
          ★
        </span>
      ))}
    </span>
  );
}
