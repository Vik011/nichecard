export function toSubscriberRange(count: number): string {
  if (count < 1000)   return '<1K'
  if (count < 5000)   return '1K–5K'
  if (count < 10000)  return '5K–10K'
  if (count < 50000)  return '10K–50K'
  if (count < 100000) return '50K–100K'
  if (count < 500000) return '100K–500K'
  return '500K+'
}
