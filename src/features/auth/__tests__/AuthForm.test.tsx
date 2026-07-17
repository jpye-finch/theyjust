import { render, fireEvent, screen } from '@testing-library/react-native';
import { AuthForm } from '../AuthForm';

describe('AuthForm', () => {
  it('submits trimmed email and password', () => {
    const onSubmit = jest.fn();
    render(<AuthForm submitLabel="Sign in" onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), '  jo@example.com ');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'hunter22');
    fireEvent.press(screen.getByText('Sign in'));

    expect(onSubmit).toHaveBeenCalledWith('jo@example.com', 'hunter22');
  });

  it('blocks submit and shows a message when fields are empty', () => {
    const onSubmit = jest.fn();
    render(<AuthForm submitLabel="Sign in" onSubmit={onSubmit} />);

    fireEvent.press(screen.getByText('Sign in'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your email and password')).toBeTruthy();
  });

  it('shows the error passed in', () => {
    render(<AuthForm submitLabel="Sign in" onSubmit={jest.fn()} error="Invalid login credentials" />);
    expect(screen.getByText('Invalid login credentials')).toBeTruthy();
  });
});
