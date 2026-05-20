/** Split EUR price for display: main part + smaller decimal digits (nl-NL: € 19,99). */
export function splitCreditPrice(amount: number): { main: string; cents: string } {
  const formatted = amount.toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const centsMatch = formatted.match(/([,.]\d{2})$/);
  if (!centsMatch) return { main: formatted, cents: "" };
  const cents = centsMatch[1];
  return { main: formatted.slice(0, -cents.length), cents };
}

type CreditPriceProps = {
  amount: number;
  className?: string;
  mainClassName?: string;
  centsClassName?: string;
};

export function CreditPrice({
  amount,
  className = "",
  mainClassName = "text-[16px] font-bold leading-none",
  centsClassName = "text-[10px] font-bold leading-none opacity-85",
}: CreditPriceProps) {
  const { main, cents } = splitCreditPrice(amount);
  return (
    <span className={`inline-flex items-baseline tabular-nums text-ink ${className}`}>
      <span className={mainClassName}>{main}</span>
      {cents ? <span className={centsClassName}>{cents}</span> : null}
    </span>
  );
}
