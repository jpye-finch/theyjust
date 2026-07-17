import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { ChildForm } from '../ChildForm';

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
    await user.type(screen.getByPlaceholderText('Date of birth (YYYY-MM-DD)'), '2026-01-15');
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
    await user.type(screen.getByPlaceholderText('Date of birth (YYYY-MM-DD)'), '2026-01-15');
    expect(screen.queryByPlaceholderText('Due date (YYYY-MM-DD)')).toBeNull();
    await togglePremature(true);
    await user.type(screen.getByPlaceholderText('Due date (YYYY-MM-DD)'), '2026-03-20');
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
    await user.type(screen.getByPlaceholderText('Date of birth (YYYY-MM-DD)'), '2026-02-30');
    await user.press(screen.getByText('Add child'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the date of birth as YYYY-MM-DD')).toBeTruthy();
  });

  it('blocks a due date on or before the date of birth', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<ChildForm submitLabel="Add child" onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText('Name'), 'Aria');
    await user.type(screen.getByPlaceholderText('Date of birth (YYYY-MM-DD)'), '2026-01-15');
    await togglePremature(true);
    await user.type(screen.getByPlaceholderText('Due date (YYYY-MM-DD)'), '2026-01-10');
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
