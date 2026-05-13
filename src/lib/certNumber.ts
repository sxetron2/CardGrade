import { getCardTypeInfo } from "@/types";

export function generateCertNumber(cardType: string): string {
  const prefix = getCardTypeInfo(cardType).certPrefix;
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random() * 9000000 + 1000000).toString();
  return `${prefix}${year}-${random}`;
}
