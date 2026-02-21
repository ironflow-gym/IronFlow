export const isCardioCategory = (cat: string) => {
  const c = cat.toLowerCase();
  return c.includes('cardio') || c.includes('running') || c.includes('cycling') || c.includes('rowing') || c.includes('swimming') || c.includes('endurance') || c.includes('hiit');
};

export const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
