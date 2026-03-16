export function toIsoString(input?: string) {
  return input ? new Date(input).toISOString() : new Date().toISOString();
}

export function minutesBetween(startedAt: string, endedAt: string) {
  const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const minutes = Math.round(diffMs / 60000);
  return Math.max(minutes, 1);
}

export function weekRange(input: string) {
  const date = new Date(input);
  const day = date.getUTCDay();
  const distanceToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(date);
  weekStart.setUTCDate(date.getUTCDate() + distanceToMonday);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  return {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
  };
}
