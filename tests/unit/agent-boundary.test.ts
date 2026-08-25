/**
 * `AGENTS.md` is public. The private rules are not (#325).
 *
 * `AGENTS.md` is the first file a foreign agent opens — that is the point of
 * the convention. For months this repository published a generated index of a
 * repository no clone has: eleven `.agent/…` paths that resolve to nothing,
 * a glob table routing `worker/**`, `Dockerfile` and `application.properties`
 * to rules, in a project with none of those, and a `.claude/skills` symlink
 * pointing outside the tree, tracked, and therefore broken on every clone.
 *
 * Two things make that hard to keep fixed. The generator that wrote it lives
 * in the private repository, so it can overwrite this file at any time from
 * outside anything CI can see; and a dangling reference fails silently — an
 * agent reading it loads nothing and gets no warning, which is exactly the
 * failure mode the project already documents for worktrees.
 *
 * So the boundary is asserted here rather than trusted. This is a unit test
 * and not a sixteenth CI step on purpose: the step count is quoted in the
 * public copy on /deconstruyendo, and `npm test` already runs on every PR.
 *
 * Existence is resolved against `git ls-files`, never against the filesystem.
 * The private directory is present on a maintainer's machine and absent from
 * every clone, so the working tree would answer "fine" for precisely the
 * reader this test protects.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");

const git = (...args: string[]): string =>
	execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

/**
 * `git grep` exits 1 on "no matches", which `execFileSync` throws for. An empty
 * result is the expected answer here, so it must not read as a crashed command
 * — but a real failure (bad pathspec, not a repository) still has to surface.
 */
function gitGrep(pattern: string, ...pathspec: string[]): string[] {
	try {
		return git("grep", "-nI", "-e", pattern, "--", ...pathspec).split("\n").filter(Boolean);
	} catch (err) {
		const e = err as { status?: number; stdout?: string };
		if (e.status === 1 && !e.stdout?.trim()) return [];
		throw err;
	}
}

/** What a clone receives — the index, not the disk. */
function trackedPaths(): Set<string> {
	return new Set(git("ls-files", "-z").split("\0").filter(Boolean));
}

/** Tracked symlinks, as `path -> target`. Mode 120000 in the index. */
function trackedSymlinks(): { path: string; target: string }[] {
	return git("ls-files", "-s", "-z")
		.split("\0")
		.filter((l) => l.startsWith("120000"))
		.map((l) => {
			const path = l.slice(l.indexOf("\t") + 1);
			return { path, target: git("cat-file", "blob", l.split(/\s+/)[1]).trim() };
		});
}

/** Relative markdown links in a document, minus anchors and external URLs. */
function localLinks(markdown: string): string[] {
	return [...markdown.matchAll(/\]\(([^)]+)\)/g)]
		.map((m) => m[1].split("#")[0].trim())
		.filter((href) => href && !/^[a-z]+:/i.test(href) && !href.startsWith("/"))
		.map((href) => href.replace(/\/$/, ""));
}

describe("AGENTS.md is a public guide, not a private index", () => {
	const agents = readFileSync(join(ROOT, "AGENTS.md"), "utf8");

	it("references no path inside the private rules repository", () => {
		const leaked = agents
			.split("\n")
			.map((line, i) => ({ line, n: i + 1 }))
			.filter(({ line }) => /(^|[\s"'`(/])\.agent\//.test(line));
		expect(leaked.map((l) => `${l.n}: ${l.line.trim()}`)).toEqual([]);
	});

	it("every relative link it offers is a path a clone actually receives", () => {
		const tracked = trackedPaths();
		const dangling = localLinks(agents).filter(
			(href) => !tracked.has(href) && ![...tracked].some((f) => f.startsWith(`${href}/`)),
		);
		expect(dangling).toEqual([]);
	});

	it("does not route rules at file types this project does not have", () => {
		// The generated table shipped globs for a Java/Docker service. A row
		// naming a path no clone contains is not guidance, it is noise that
		// reads as guidance.
		const absent = ["worker/", "Dockerfile", "docker-compose", "application.properties"];
		expect(absent.filter((needle) => agents.includes(needle))).toEqual([]);
	});
});

/**
 * Does this symlink point at something a clone will not have? The two early
 * returns are shortcuts; the load-bearing check is the last line, which asks
 * the index rather than the disk.
 */
function escapes({ path, target }: { path: string; target: string }, tracked: Set<string>): boolean {
	if (target.startsWith("/")) return true;
	const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
	const resolved = join(dir, target).replace(/\\/g, "/");
	if (resolved.startsWith("..")) return true;
	return !tracked.has(resolved) && ![...tracked].some((f) => f.startsWith(`${resolved}/`));
}

describe("no tracked symlink escapes the repository", () => {
	const tracked = trackedPaths();

	it("recognises one that does — the inventory below is empty, and has to be", () => {
		// Nothing is expected to fail the real assertion any more, which means it
		// would pass just as green with the predicate gutted. So the predicate is
		// exercised here instead: the link this change removed, an absolute one,
		// one that stays inside the tree but is not in the index (only the last
		// line catches that one), and one that is genuinely fine.
		expect(escapes({ path: ".claude/skills", target: "../.agent/skills" }, tracked)).toBe(true);
		expect(escapes({ path: "docs/link.md", target: "/etc/passwd" }, tracked)).toBe(true);
		expect(escapes({ path: "docs/link.md", target: "generated/out.md" }, tracked)).toBe(true);
		expect(escapes({ path: "docs/link.md", target: "architecture.md" }, tracked)).toBe(false);
	});

	it("because a clone gets the link and not what it points at", () => {
		const escaping = trackedSymlinks().filter((s) => escapes(s, tracked));
		expect(escaping.map((s) => `${s.path} -> ${s.target}`)).toEqual([]);
	});
});

describe("no tracked file points a reader inside the private rules repository", () => {
	it("because the path resolves in no clone, and says nothing about which one", () => {
		// The bare directory may be *named* — explaining why the public vendored
		// pack was renamed away from it requires saying so. What may not appear is
		// a path INTO it: a skill, a rule, a script. Those are the references that
		// read as guidance and lead nowhere.
		const pointers = gitGrep("\\.agent/[A-Za-z0-9_.]", ".", ":!tests/unit/agent-boundary.test.ts");
		expect(pointers).toEqual([]);
	});
});

describe("the pull request template asks for checks this project has", () => {
	const template = readFileSync(join(ROOT, ".github", "pull_request_template.md"), "utf8");

	it("names no npm script that does not exist", () => {
		// It shipped `npm run lint`, which this project has never had, next to a
		// row about a Cloudflare Worker build in a repository with no worker/.
		// A checklist row nobody can tick is ticked anyway.
		const scripts = new Set(
			Object.keys(JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts ?? {}),
		);
		const named = [...template.matchAll(/`npm (?:run )?([a-z:-]+)`/g)].map((m) => m[1]);
		// Positive control: `npm run lint` is gone, so a pattern that only knew the
		// `run` form would now match nothing and pass for the wrong reason.
		expect(named.length).toBeGreaterThan(0);
		expect(named.filter((s) => !scripts.has(s))).toEqual([]);
	});
});
