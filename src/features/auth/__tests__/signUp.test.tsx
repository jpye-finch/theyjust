import { render, screen, userEvent } from '@testing-library/react-native';
import SignUp from '../../../app/(auth)/sign-up';
import { supabase } from '../../../lib/supabase';

jest.mock('../../../lib/supabase', () => ({
  supabase: { auth: { signUp: jest.fn() } },
}));

const mockedSignUp = supabase.auth.signUp as jest.Mock;

afterEach(() => jest.clearAllMocks());

async function submit() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Email'), 'parent@test.local');
  await user.type(screen.getByPlaceholderText('Password'), 'hunter2hunter2');
  await user.press(screen.getByText('Sign up'));
}

describe('SignUp', () => {
  it('asks the parent to check their email when no session comes back', async () => {
    // Supabase returns a user but a null session when confirmations are on.
    mockedSignUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    });
    await render(<SignUp />);
    await submit();

    expect(await screen.findByText('Check your email')).toBeTruthy();
    expect(
      screen.getByText('We sent a confirmation link to parent@test.local. Tap it and you are in.'),
    ).toBeTruthy();
    // The form is done: leaving it on screen invites a confused second sign-up.
    expect(screen.queryByPlaceholderText('Password')).toBeNull();
  });

  it('stays quiet when a session comes back, letting the auth gate redirect', async () => {
    mockedSignUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 'a' } },
      error: null,
    });
    await render(<SignUp />);
    await submit();

    expect(screen.queryByText('Check your email')).toBeNull();
  });

  it('shows the error and keeps the form when sign-up fails', async () => {
    mockedSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });
    await render(<SignUp />);
    await submit();

    expect(await screen.findByText('User already registered')).toBeTruthy();
    // A failure must NOT read as "check your email" — that would send the parent
    // hunting for an email that was never sent.
    expect(screen.queryByText('Check your email')).toBeNull();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
  });
});
