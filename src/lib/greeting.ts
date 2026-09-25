export function getTimeOfDayGreeting(date: Date = new Date()): string {
  const hours = date.getHours();
  if (hours < 12) return 'Good morning';
  if (hours < 18) return 'Good afternoon';
  return 'Good evening';
}
