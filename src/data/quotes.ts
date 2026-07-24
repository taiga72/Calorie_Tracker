export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: Quote[] = [
  { text: 'Small daily improvements are the key to staggering long-term results.', author: 'James Clear' },
  { text: 'You do not have to be extreme, just consistent.', author: 'Unknown' },
  { text: 'Take care of your body. It is the only place you have to live.', author: 'Jim Rohn' },
  { text: 'Health is not about the weight you lose, but the life you gain.', author: 'Dr. Josh Axe' },
  { text: 'The food you eat can be either the safest medicine or the slowest poison.', author: 'Ann Wigmore' },
  { text: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier' },
  { text: 'One meal at a time. One day at a time. One pound at a time.', author: 'Unknown' },
  { text: 'Eat to nourish your body, not to punish it.', author: 'Unknown' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'Your body can stand almost anything. It is your mind you have to convince.', author: 'Andrew Murphy' },
  { text: 'Slow progress is still progress. Keep going.', author: 'Unknown' },
  { text: 'Wellness is the natural state of the body when given the right conditions.', author: 'Unknown' },
  { text: 'Do not start a diet that has an expiration date. Focus on a lifestyle that lasts.', author: 'Unknown' },
  { text: 'You do not have to eat less. You just have to eat right.', author: 'Unknown' },
  { text: 'Every healthy choice is a vote for the person you want to become.', author: 'Unknown' },
  { text: 'The only bad workout is the one that did not happen.', author: 'Unknown' },
  { text: 'Habit is the intersection of knowledge, skill, and desire.', author: 'Stephen Covey' },
  { text: 'Mindful eating is not a diet. It is a way of life.', author: 'Susan Albers' },
  { text: 'You are what you repeatedly do. Excellence is a habit.', author: 'Aristotle' },
  { text: 'Progress, not perfection, is the goal.', author: 'Unknown' },
  { text: 'Listen to your body. It is wiser than you think.', author: 'Unknown' },
  { text: 'The journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'Consistency is what transforms average into excellence.', author: 'Unknown' },
  { text: 'Nourish your body, and it will nourish you back.', author: 'Unknown' },
];

export function getDailyQuote(date = new Date()): Quote {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  const index = dayOfYear % QUOTES.length;
  return QUOTES[index];
}
