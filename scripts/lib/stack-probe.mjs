/**
 * Answer "is the stack up?" instead of asking it (#390).
 *
 * A `wrangler dev` session died in the middle of a gate run on 2026-08-25.
 * Every guard reported honestly what it saw — a navigation timeout on one
 * route, then ERR_CONNECTION_REFUSED — and every one of those messages points
 * at the route, or at the guard, or at the diff being tested. None of them
 * points at the stack, because none of them looked.
 *
 * It cost a full investigation to rule out. The next person's first instinct
 * will be to hunt through their own change, so the guard has to say what it
 * costs one HTTP request to find out.
 *
 * This adds information and nothing else. It does not retry, does not widen a
 * timeout and does not change an exit code — masking the crash would destroy
 * the only signal that currently reveals it, which is what #390 asks for.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LOG = join(process.env.RUNNER_TEMP || "/tmp", "wrangler-ci.log");

/** Did the stack answer at all? Any HTTP status counts — a 404 is a live server. */
async function answers(baseUrl) {
	try {
		await fetch(baseUrl, { signal: AbortSignal.timeout(3000) });
		return true;
	} catch {
		return false;
	}
}

/**
 * One line naming the fact, plus the stack's own last words when it is gone.
 * Returns "" when the stack is fine — the caller's message already stands, and
 * a second line saying "by the way, the server is up" is noise.
 */
export async function stackDiagnosis(baseUrl) {
	if (await answers(baseUrl)) return "";
	const lines = [
		`  → ${baseUrl} is not answering at all: the stack is gone, and this failure`,
		"    is not about the route above. A stack that dies mid-run puts the suite",
		"    red for a reason unrelated to the change under test (#390).",
	];
	if (existsSync(LOG)) {
		const tail = readFileSync(LOG, "utf8").trimEnd().split("\n").slice(-12);
		lines.push(`    Last ${tail.length} line(s) of ${LOG}:`);
		for (const l of tail) lines.push(`      ${l}`);
	} else {
		lines.push(`    No wrangler log at ${LOG} — boot it with scripts/ci-local-stack.sh`);
	}
	return lines.join("\n");
}
