import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OnboardingFlow from "./OnboardingFlow";

describe("OnboardingFlow", () => {
  it("blocks advancing past the goal step until required fields are filled", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(
      <OnboardingFlow
        onComplete={onComplete}
        starting={false}
        error={null}
        reducedMotion
        showIntro={false}
      />,
    );

    // Duration has a default value; goal/success criteria start empty.
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(await screen.findByText(/tell the frog what you're working on/i)).toBeInTheDocument();
    // Still on the goal step — the profile heading should not have appeared.
    expect(screen.queryByRole("heading", { name: /how annoying/i })).not.toBeInTheDocument();
  });

  it("advances to the profile step once the goal form is valid", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(
      <OnboardingFlow
        onComplete={onComplete}
        starting={false}
        error={null}
        reducedMotion
        showIntro={false}
      />,
    );

    await user.type(screen.getByLabelText(/^goal$/i), "Write the report");
    await user.type(screen.getByLabelText(/what does "done" look like/i), "Report sent");
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(await screen.findByRole("heading", { name: /how annoying/i })).toBeInTheDocument();
  });
});
