import { describe, expect, it } from "vitest";
import { formatErrorMessage } from "../errorMessage";

describe("formatErrorMessage", () => {
  it("formats nested OpenAI stream errors without [object Object]", () => {
    expect(
      formatErrorMessage({
        type: "error",
        error: {
          code: "server_error",
          message: "An error occurred while processing your request.",
          request_id: "req_123",
        },
      }),
    ).toBe(
      "An error occurred while processing your request. (server_error, req_123)",
    );
  });

  it("returns Error messages directly", () => {
    expect(formatErrorMessage(new Error("Boom"))).toBe("Boom");
  });
});
