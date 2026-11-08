import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { InstallPromptProvider, useInstallPrompt } from "./InstallPromptProvider";

function Status() {
  const { installed } = useInstallPrompt();
  return <output data-testid="installed">{String(installed)}</output>;
}

function LanguageControl() {
  const { toggleLocale, locale } = useI18n();
  const { openInstall } = useInstallPrompt();
  return <button onClick={() => { toggleLocale(); openInstall(); }}>{locale}</button>;
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); sessionStorage.clear(); });

describe("automatic mobile installation invitation", () => {
  it("keeps the install dialog connected to the shared language provider", async () => {
    localStorage.clear();
    render(<I18nProvider><InstallPromptProvider><LanguageControl /></InstallPromptProvider></I18nProvider>);
    await act(async () => { screen.getByRole("button", { name: "ar" }).click(); });
    expect(screen.getByRole("dialog")).toHaveAttribute("dir", "ltr");
    expect(screen.getByRole("heading")).toBeInTheDocument();
    localStorage.clear();
  });
  it("opens automatically on mobile and closes when installation is confirmed", async () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Android Mobile Chrome");
    render(<I18nProvider><InstallPromptProvider><Status /></InstallPromptProvider></I18nProvider>);
    await act(async () => { vi.advanceTimersByTime(9000); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => { window.dispatchEvent(new Event("appinstalled")); });
    expect(screen.getByTestId("installed")).toHaveTextContent("true");
  });

  it("does not show the automatic invitation inside an installed app", async () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone Mobile Safari");
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query === "(display-mode: standalone)", media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    render(<I18nProvider><InstallPromptProvider><Status /></InstallPromptProvider></I18nProvider>);
    await act(async () => { vi.advanceTimersByTime(9000); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("installed")).toHaveTextContent("true");
  });
});