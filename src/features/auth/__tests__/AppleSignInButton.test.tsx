import { render, screen } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { radius } from '@/theme/tokens';
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
    const button = await screen.findByTestId('apple-sign-in');
    expect(button).toBeTruthy();
    // "Continue", not "Sign in": one tap both creates the account and returns
    // to it, and the parent should not have to know which is which.
    expect(button.props.buttonType).toBe(AppleAuthentication.AppleAuthenticationButtonType.CONTINUE);
    // Black on warm paper — WHITE would vanish into the page.
    expect(button.props.buttonStyle).toBe(AppleAuthentication.AppleAuthenticationButtonStyle.BLACK);
    // Matched to PrimaryButton so the two sit together.
    expect(button.props.cornerRadius).toBe(radius.md);
  });

  it('renders nothing where it does not', async () => {
    // Android, web, and iOS below 13. A dead button that cannot explain itself
    // is worse than no button.
    mockedAvailable.mockResolvedValue(false);
    await render(<AppleSignInButton onPress={jest.fn()} />);
    expect(screen.queryByTestId('apple-sign-in')).toBeNull();
  });
});
