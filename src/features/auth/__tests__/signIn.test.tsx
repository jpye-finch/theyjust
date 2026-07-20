import { render, screen } from '@testing-library/react-native';
import SignIn from '../../../app/(auth)/sign-in';

jest.mock('../../../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: jest.fn() } },
}));

describe('SignIn', () => {
  it('shows the brand mark above the wordmark', async () => {
    await render(<SignIn />);

    expect(screen.getByTestId('brand-mark')).toBeTruthy();
    expect(screen.getByText('Firsts')).toBeTruthy();
  });

  // The wordmark sits directly beneath it and already names the app, so the
  // mark is decoration — announcing it would just make a screen reader say
  // "Firsts" twice.
  it('hides the mark from screen readers', async () => {
    await render(<SignIn />);

    expect(screen.getByTestId('brand-mark').props.accessible).toBe(false);
  });
});
