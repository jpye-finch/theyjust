import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { ChildForm } from '../ChildForm';

// DateField wraps a platform date picker (native) / the browser's date input
// (web), neither of which can be typed into. These tests exercise ChildForm's
// own validation, so stub it with a plain text input keyed by its label; the
// real picker is verified at runtime.
jest.mock('../../../components/DateField', () => {
  const React = require('react');
  const { TextInput } = require('react-native');
  return {
    DateField: ({
      label,
      value,
      onChange,
    }: {
      label: string;
      value: string;
      onChange: (iso: string) => void;
    }) =>
      React.createElement(TextInput, { accessibilityLabel: label, value, onChangeText: onChange }),
  };
});

// userEvent has no Switch interaction; fireEvent 'valueChange' is the
// documented way to drive RN Switch in RNTL. In RNTL v14 fireEvent is async
// (wraps the handler in act()) — it must be awaited or the re-render hasn't
// flushed when the next query runs.
async function togglePremature(value: boolean) {
  await fireEvent(screen.getByRole('switch'), 'valueChange', value);
}

describe('ChildForm', () => {
  it('submits a term child with a null due date', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<ChildForm submitLabel="Add child" onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('Name'), '  Aria ');
    await user.type(screen.getByLabelText('Date of birth'), '2026-01-15');
    await user.press(screen.getByText('Add child'));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Aria',
      dateOfBirth: '2026-01-15',
      dueDate: null,
    });
  });

  it('reveals the due date field for premature children and submits it', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<ChildForm submitLabel="Add child" onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('Name'), 'Aria');
    await user.type(screen.getByLabelText('Date of birth'), '2026-01-15');
    expect(screen.queryByLabelText('Due date')).toBeNull();
    await togglePremature(true);
    await user.type(screen.getByLabelText('Due date'), '2026-03-20');
    await user.press(screen.getByText('Add child'));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Aria',
      dateOfBirth: '2026-01-15',
      dueDate: '2026-03-20',
    });
  });

  it('blocks an invalid date of birth', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<ChildForm submitLabel="Add child" onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('Name'), 'Aria');
    await user.type(screen.getByLabelText('Date of birth'), '2026-02-30');
    await user.press(screen.getByText('Add child'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the date of birth as YYYY-MM-DD')).toBeTruthy();
  });

  it('blocks a due date on or before the date of birth', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<ChildForm submitLabel="Add child" onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('Name'), 'Aria');
    await user.type(screen.getByLabelText('Date of birth'), '2026-01-15');
    await togglePremature(true);
    await user.type(screen.getByLabelText('Due date'), '2026-01-10');
    await user.press(screen.getByText('Add child'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('The due date should be after the date of birth')).toBeTruthy();
  });

  it('shows a server error passed in', async () => {
    await render(<ChildForm submitLabel="Add child" onSubmit={jest.fn()} error="Network request failed" />);
    expect(screen.getByText('Network request failed')).toBeTruthy();
  });

  it('prefills initial values for editing', async () => {
    await render(
      <ChildForm
        submitLabel="Save"
        onSubmit={jest.fn()}
        initial={{ name: 'Aria', dateOfBirth: '2026-01-15', dueDate: '2026-03-20' }}
      />,
    );
    expect(screen.getByDisplayValue('Aria')).toBeTruthy();
    expect(screen.getByDisplayValue('2026-03-20')).toBeTruthy();
  });
});
