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

	const contentDir = path.join('src', 'content', 'docs');
	mkdirSync(contentDir, { recursive: true });
	for (const page of convertedPages) {
		const relativePath = page.slug.replace(/^docs\//, '');
		const filePath = path.join(contentDir, `${relativePath}.md`);
		mkdirSync(path.dirname(filePath), { recursive: true });
		const frontmatter = `---\ntitle: ${JSON.stringify(page.title)}\n---\n\n`;
		writeFileSync(filePath, frontmatter + page.body);
	}

	writeFileSync(
		path.join('src', 'wiki-nav.json'),
		JSON.stringify(
			nav.map((entry) => ({ label: entry.label, slug: entry.slug })),
			null,
			2,
		),
	);
} finally {
	rmSync(workDir, { recursive: true, force: true });
}
