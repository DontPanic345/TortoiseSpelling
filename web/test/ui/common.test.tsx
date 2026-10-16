// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackButton } from "../../src/ui/common/BackButton";
import { Dialog } from "../../src/ui/common/Dialog";
import { EmptyState } from "../../src/ui/common/EmptyState";
import { Snackbar, useSnackbar } from "../../src/ui/common/Snackbar";
import { Stepper } from "../../src/ui/common/Stepper";
import { TopBar } from "../../src/ui/common/TopBar";

describe("Dialog", () => {
  it("opens as a modal with its title, content and actions", () => {
    render(
      <Dialog title="Delete “x”?" onDismiss={() => {}} actions={<button type="button">Delete</button>}>
        <p>Its review history goes too.</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Delete “x”?" });
    expect((dialog as HTMLDialogElement).open).toBe(true);
    expect(screen.getByText("Its review history goes too.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("is dismissed by the cancel event Escape fires", () => {
    const onDismiss = vi.fn();
    render(
      <Dialog title="Title" onDismiss={onDismiss}>
        body
      </Dialog>,
    );
    const cancel = new Event("cancel", { cancelable: true });
    screen.getByRole("dialog").dispatchEvent(cancel);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(cancel.defaultPrevented).toBe(true);
  });

  it("is dismissed by a click on the backdrop but not on its content", () => {
    const onDismiss = vi.fn();
    render(
      <Dialog title="Title" onDismiss={onDismiss}>
        <p>body</p>
      </Dialog>,
    );
    fireEvent.click(screen.getByText("body"));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("dialog"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("closes when its owner unmounts it", () => {
    const { rerender } = render(
      <Dialog title="Title" onDismiss={() => {}}>
        body
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeNull();
    rerender(<div />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Snackbar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function Harness({ onAction }: { onAction?: () => void }) {
    const snackbar = useSnackbar();
    return (
      <>
        <button type="button" onClick={() => snackbar.show("First")}>
          first
        </button>
        <button type="button" onClick={() => snackbar.show("Second", onAction && { label: "Undo", onClick: onAction })}>
          second
        </button>
        <Snackbar message={snackbar.current} />
      </>
    );
  }

  it("shows one message and then clears it after four seconds", () => {
    render(<Harness />);
    expect(screen.queryByText("First")).toBeNull();
    fireEvent.click(screen.getByText("first"));
    expect(screen.getByRole("status").textContent).toBe("First");
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(screen.queryByText("First")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("First")).toBeNull();
  });

  it("replaces a message with the next and restarts the clock", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("first"));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByText("second"));
    expect(screen.queryByText("First")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText("Second")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("Second")).toBeNull();
  });

  it("runs its action", () => {
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);
    fireEvent.click(screen.getByText("second"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe("Stepper", () => {
  const ids = { value: "v", decrease: "d", increase: "i" };

  it("steps by one and shows the value", () => {
    const onChange = vi.fn();
    render(<Stepper value={10} min={1} max={100} onChange={onChange} testIds={ids} />);
    expect(screen.getByTestId("v").textContent).toBe("10");
    fireEvent.click(screen.getByRole("button", { name: "Increase" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease" }));
    expect(onChange.mock.calls).toEqual([[11], [9]]);
  });

  it("disables Decrease at the minimum", () => {
    render(<Stepper value={1} min={1} max={100} onChange={() => {}} testIds={ids} />);
    expect((screen.getByTestId("d") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("i") as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables Increase at the maximum", () => {
    render(<Stepper value={100} min={1} max={100} onChange={() => {}} testIds={ids} />);
    expect((screen.getByTestId("i") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("d") as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("TopBar, BackButton and EmptyState", () => {
  it("lays out a title with a back button and actions", () => {
    const onBack = vi.fn();
    render(<TopBar title="Settings" navigation={<BackButton onClick={onBack} />} actions={<span>menu</span>} />);
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByText("menu")).toBeTruthy();
  });

  it("shows an empty state's title, body and action", () => {
    render(
      <EmptyState icon={<span>icon</span>} title="No words yet" body="Add one to begin.">
        <button type="button">Add word</button>
      </EmptyState>,
    );
    expect(screen.getByRole("heading", { name: "No words yet" })).toBeTruthy();
    expect(screen.getByText("Add one to begin.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add word" })).toBeTruthy();
  });
});
