import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeSheet } from '@/components/WelcomeSheet';

const base = { open: true, onClose: vi.fn(), name: 'Sam', goalSet: false, mealLogged: false, onSetGoal: vi.fn(), onLogMeal: vi.fn() };

describe('WelcomeSheet', () => {
  it('greets by name and starts each step', () => {
    const onSetGoal = vi.fn();
    const onLogMeal = vi.fn();
    render(<WelcomeSheet {...base} onSetGoal={onSetGoal} onLogMeal={onLogMeal} />);
    expect(screen.getByText('Welcome, Sam 👋')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Set your goal/));
    fireEvent.click(screen.getByText(/Log your first meal/));
    expect(onSetGoal).toHaveBeenCalled();
    expect(onLogMeal).toHaveBeenCalled();
    expect(screen.getByText('Got it')).toBeInTheDocument();
  });

  it('says you are all set once both steps are done', () => {
    render(<WelcomeSheet {...base} goalSet mealLogged />);
    expect(screen.getByText("All set — let's go")).toBeInTheDocument();
  });
});
