import { render, screen, userEvent } from '@testing-library/react-native';
import { AuthForm } from '../AuthForm';

describe('AuthForm', () => {
  it('submits trimmed email and password', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<AuthForm submitLabel="Sign in" onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('Email'), '  jo@example.com ');
    await user.type(screen.getByPlaceholderText('Password'), 'hunter22');
    await user.press(screen.getByText('Sign in'));

    expect(onSubmit).toHaveBeenCalledWith('jo@example.com', 'hunter22');
  });

  it('blocks submit and shows a message when fields are empty', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<AuthForm submitLabel="Sign in" onSubmit={onSubmit} />);

    await user.press(screen.getByText('Sign in'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your email and password')).toBeTruthy();
  });

  it('shows the error passed in', async () => {
    await render(<AuthForm submitLabel="Sign in" onSubmit={jest.fn()} error="Invalid login credentials" />);
    expect(screen.getByText('Invalid login credentials')).toBeTruthy();
  });
});
