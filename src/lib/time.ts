// Smart timestamp: today shows time only, yesterday shows "Yesterday H:MM", older shows "Mar 21 H:MM"
export const formatTime = (timestamp: number): string => {
  const now   = Date.now();
  const age   = now - timestamp;
  const date  = new Date(timestamp);
  const today = new Date();

  const hh   = date.getHours();
  const mm   = date.getMinutes().toString().padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12  = hh % 12 || 12;
  const time = `${h12}:${mm} ${ampm}`;

  // Same calendar day → just the time
  if (date.toDateString() === today.toDateString()) return time;

  // Yesterday
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;

  // Older → "Mar 21 H:MM AM"
  const mon = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${mon} ${time}`;
};

// Full date label (used for date separators in message lists)
export const formatDate = (timestamp: number): string => {
  const date      = new Date(timestamp);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString())     return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Verbose: "Today at 5:22 PM" / "Yesterday at 3:00 AM" / "Mar 21 at 5:22 PM"
export const formatDateTime = (timestamp: number): string => {
  const date      = new Date(timestamp);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const hh   = date.getHours();
  const mm   = date.getMinutes().toString().padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const time = `${hh % 12 || 12}:${mm} ${ampm}`;
  if (date.toDateString() === today.toDateString())     return `Today at ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${time}`;
};
