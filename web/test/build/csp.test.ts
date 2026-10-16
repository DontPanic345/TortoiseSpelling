import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "../../build/csp";

const directive = (policy: string, name: string) => policy.split("; ").find((part) => part.startsWith(`${name} `));

describe("contentSecurityPolicy", () => {
  it("limits connections to the app's own origin with no reminder server", () => {
    expect(directive(contentSecurityPolicy(""), "connect-src")).toBe("connect-src 'self'");
  });

  it("adds the reminder server, and only it", () => {
    const policy = contentSecurityPolicy("https://tortoisespelling-push.example.workers.dev");
    expect(directive(policy, "connect-src")).toBe("connect-src 'self' https://tortoisespelling-push.example.workers.dev");
    expect(policy.match(/workers\.dev/g)).toHaveLength(1);
  });

  it("allows nothing inline or remote elsewhere", () => {
    const policy = contentSecurityPolicy("https://push.example");
    expect(policy).not.toContain("unsafe");
    expect(directive(policy, "script-src")).toBe("script-src 'self'");
    expect(directive(policy, "default-src")).toBe("default-src 'self'");
  });
});
