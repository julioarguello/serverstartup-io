/**
 * stack-probe.mjs — the two ways a browser-driven gate dies without the diff
 * having anything to do with it.
 *
 * `cdpDiagnosis` is a message, and a message has no exit code to fail on: if it
 * ever stopped matching the error puppeteer actually throws, the gate would go
 * back to printing `FAIL Accessibility` over a browser that simply stopped
 * answering its debugger, and nobody would notice until the next person spent
 * an afternoon on it (#425). So the shape of that error is pinned here.
 *
 * The strings below are the real ones, copied from the two runs of 2026-08-30 —
 * not a paraphrase of what puppeteer 23.11.1 is assumed to say.
 */
import { describe, expect, it } from "vitest";

import { cdpDiagnosis } from "../../scripts/lib/stack-probe.mjs";

/** What puppeteer throws: `ProtocolError` is a name, not a class we can import. */
const protocolError = (message: string) => {
	const e = new Error(message);
	e.name = "ProtocolError";
	return e;
};

describe("cdpDiagnosis", () => {
	it("names a CDP timeout for what it is", () => {
		const out = cdpDiagnosis(
			protocolError(
				"Network.enable timed out. Increase the 'protocolTimeout' setting in " +
					"launch/connect calls for a higher timeout if needed.",
			),
		);
		expect(out).toContain("CDP timeout");
		expect(out).toContain("not a finding");
		expect(out).toContain("#425");
	});

	it("recognises it wherever in the suite it lands", () => {
		// The second occurrence was a different CDP method, in a different
		// section — the match must be on the shape, not on one method name.
		expect(cdpDiagnosis(protocolError("Runtime.callFunctionOn timed out."))).not.toBe("");
	});

	it("stays silent for every other failure", () => {
		// A real a11y failure, a navigation timeout and a dead socket must all
		// keep the caller's own message: this helper adds a fact or nothing.
		expect(cdpDiagnosis(new Error("Navigation timeout of 60000 ms exceeded"))).toBe("");
		expect(cdpDiagnosis(protocolError("Target closed"))).toBe("");
		expect(cdpDiagnosis(undefined)).toBe("");
		expect(cdpDiagnosis({ name: "ProtocolError" })).toBe("");
	});
});
