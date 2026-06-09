import { describe, expect, it } from "vitest";
import { requiresApproval } from "../riskGate";

const click = (targetText: string, targetRole = "button") => ({
  kind: "click" as const,
  targetText,
  targetRole,
});

describe("RiskGate", () => {
  it("gates an authentication action (sign in)", () => {
    expect(requiresApproval(click("Sign in"))).toBe(true);
  });

  it("lets a plainly safe action proceed without a gate", () => {
    expect(requiresApproval(click("Read more", "link"))).toBe(false);
    expect(
      requiresApproval({ kind: "type", targetText: "Search", targetRole: "searchbox" })
    ).toBe(false);
    expect(requiresApproval({ kind: "scroll", targetText: "", targetRole: "" })).toBe(false);
  });

  it("gates purchase / checkout actions", () => {
    expect(requiresApproval(click("Buy now"))).toBe(true);
    expect(requiresApproval(click("Place order"))).toBe(true);
    expect(requiresApproval(click("Proceed to checkout"))).toBe(true);
    expect(requiresApproval(click("Pay $40.00"))).toBe(true);
  });

  it("gates send actions (email / message)", () => {
    expect(requiresApproval(click("Send"))).toBe(true);
    expect(requiresApproval(click("Send message"))).toBe(true);
    expect(requiresApproval(click("Reply all"))).toBe(true);
    expect(requiresApproval(click("Post"))).toBe(true);
  });

  it("gates file uploads", () => {
    expect(requiresApproval(click("Upload"))).toBe(true);
    expect(
      requiresApproval({ kind: "click", targetText: "Choose file", targetRole: "button" })
    ).toBe(true);
  });

  it("gates a real form submit button", () => {
    expect(requiresApproval(click("Submit", "button"))).toBe(true);
    expect(requiresApproval(click("Submit application", "button"))).toBe(true);
  });

  it("does not gate a 'submit'-labeled link (navigation, not a form submission)", () => {
    // e.g. a footer link reading "How to submit a request" — clicking it just navigates.
    expect(requiresApproval(click("How to submit a request", "link"))).toBe(false);
  });

  it("gates anything the agent explicitly flags as consequential", () => {
    expect(
      requiresApproval(click("Do the thing"), { flaggedConsequential: true })
    ).toBe(true);
  });
});
