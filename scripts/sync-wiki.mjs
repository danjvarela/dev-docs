#!/usr/bin/env node
// Orchestration glue: clones <repo>.wiki.git, feeds pages into the pure
// conversion module, and writes the result into the Astro content
// collection + sidebar config. Not unit tested (thin glue around the
// tested module) — verify by running the workflow and inspecting the site.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { convertWiki } from '../src/lib/wiki-convert.ts';

const repo = process.env.GITHUB_REPOSITORY;
if (!repo) {
	throw new Error('GITHUB_REPOSITORY env var is required (e.g. "owner/name")');
}
const token = process.env.GITHUB_TOKEN;
if (!token) {
	throw new Error('GITHUB_TOKEN env var is required to clone the private wiki repo');
}

const wikiUrl = `https://x-access-token:${token}@github.com/${repo}.wiki.git`;
const workDir = mkdtempSync(path.join(tmpdir(), 'wiki-sync-'));

try {
	execFileSync('git', ['clone', '--depth', '1', wikiUrl, workDir], { stdio: 'inherit' });

	const files = readdirSync(workDir).filter((file) => file.endsWith('.md'));
	const pages = files.map((file) => ({
		name: file.replace(/\.md$/, ''),
		content: readFileSync(path.join(workDir, file), 'utf-8'),
	}));

	const { pages: convertedPages, nav } = convertWiki(pages);

	// page.slug is "docs/Page-Name": the Starlight docs collection root is the
	// site root, so a file must live at src/content/docs/docs/Page-Name.md to
	// produce both the /docs/Page-Name route and a matching collection slug
	// for the sidebar config (which references slugs, not routes). An explicit
	// `slug` frontmatter field is required too: Astro's default slug generator
	// (github-slugger) lowercases path segments, which would break the
	// case-preserved routes the spec requires.
	const contentDir = path.join('src', 'content', 'docs');
	mkdirSync(contentDir, { recursive: true });
	for (const page of convertedPages) {
		const filePath = path.join(contentDir, `${page.slug}.md`);
		mkdirSync(path.dirname(filePath), { recursive: true });
		const frontmatter = `---\ntitle: ${JSON.stringify(page.title)}\nslug: ${JSON.stringify(page.slug)}\n---\n\n`;
		writeFileSync(filePath, frontmatter + page.body);
	}

	writeFileSync(path.join('src', 'wiki-nav.json'), JSON.stringify(nav, null, 2));
} finally {
	rmSync(workDir, { recursive: true, force: true });
}
