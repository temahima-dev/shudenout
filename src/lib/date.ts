export function todayTomorrowJST() {
  const now = new Date();
  const today = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const format = (d: Date) => d.toISOString().split('T')[0];
  return { today: format(today), tomorrow: format(tomorrow) };
}
