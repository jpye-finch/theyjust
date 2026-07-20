import { render, screen } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AppleSignInButton } from '../AppleSignInButton';

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  AppleAuthenticationButton: 'AppleAuthenticationButton',
  AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1 },
  AppleAuthenticationButtonStyle: { BLACK: 0, WHITE: 1, WHITE_OUTLINE: 2 },
}));

const mockedAvailable = AppleAuthentication.isAvailableAsync as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('AppleSignInButton', () => {
  it('offers the button where Apple sign-in works', async () => {
    mockedAvailable.mockResolvedValue(true);
    await render(<AppleSignInButton onPress={jest.fn()} />);
    expect(await screen.findByTestId('apple-sign-in')).toBeTruthy();
  });

  it('renders nothing where it does not', async () => {
    // Android, web, and iOS below 13. A dead button that cannot explain itself
    // is worse than no button.
    mockedAvailable.mockResolvedValue(false);
    await render(<AppleSignInButton onPress={jest.fn()} />);
    expect(screen.queryByTestId('apple-sign-in')).toBeNull();
  });
});
