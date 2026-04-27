export const defaultCurrency = "TWD";

export const supportedCurrencies = [
  { code: "TWD", label: "TWD - New Taiwan Dollar" },
  { code: "JPY", label: "JPY - Japanese Yen" },
  { code: "USD", label: "USD - US Dollar" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "KRW", label: "KRW - South Korean Won" },
  { code: "CNY", label: "CNY - Chinese Yuan" },
  { code: "HKD", label: "HKD - Hong Kong Dollar" },
  { code: "SGD", label: "SGD - Singapore Dollar" },
  { code: "GBP", label: "GBP - British Pound" },
  { code: "AUD", label: "AUD - Australian Dollar" },
  { code: "CAD", label: "CAD - Canadian Dollar" },
] as const;

export type CurrencyCode = (typeof supportedCurrencies)[number]["code"];

const supportedCurrencyCodes = new Set<string>(
  supportedCurrencies.map((currency) => currency.code)
);

export function normalizeCurrency(value: unknown): CurrencyCode {
  if (typeof value !== "string") {
    return defaultCurrency;
  }
  const normalized = value.trim().toUpperCase();
  return supportedCurrencyCodes.has(normalized)
    ? (normalized as CurrencyCode)
    : defaultCurrency;
}

export function formatCurrencyAmount(amount: number, currency: string = defaultCurrency) {
  const normalizedCurrency = normalizeCurrency(currency);
  return new Intl.NumberFormat(undefined, {
    currency: normalizedCurrency,
    style: "currency",
  }).format(amount);
}
