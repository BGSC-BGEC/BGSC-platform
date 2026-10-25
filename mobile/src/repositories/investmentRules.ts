export function investmentLimit(balance: number, invested: number, cap?: number | null) {
  return Math.max(0, Math.floor(Math.min(balance, 100_000, cap == null ? Infinity : cap - invested)));
}

export function validInvestment(value: string, maximum: number) {
  return /^\d+$/.test(value) && Number(value) >= 10 && Number(value) <= maximum;
}

// Idempotency identifier only; it is never used as a credential.
export function investmentRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}
