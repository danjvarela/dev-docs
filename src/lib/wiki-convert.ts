/**
 * Pure conversion of raw GitHub wiki pages into Astro content-collection
 * entries plus a nav structure. No network or git calls in this module —
 * that happens in the orchestration script that calls it.
 */

export interface WikiPage {
	/** Wiki page filename without extension, e.g. "Getting-Started" */
	name: string;
	content: string;
}

export interface ConvertedPage {
	/** Astro route slug, e.g. "docs/Getting-Started" */
	slug: string;
	title: string;
	body: string;
}

/** A single doc link, or a group of nested entries (from indented `_Sidebar.md` lists). */
export type NavEntry = { label: string; slug: string } | { label: string; items: NavEntry[] };

export interface ConvertResult {
	pages: ConvertedPage[];
	nav: NavEntry[];
}

const SIDEBAR_NAME = '_Sidebar';

/** Matches GitHub wiki's own slugify: spaces -> hyphens, case preserved. */
function slugify(pageName: string): string {
	return pageName.trim().replace(/\s+/g, '-');
}

function toSlug(pageName: string): string {
	return `docs/${slugify(pageName)}`;
}

/** Splits `Page Name` or `Text|Page Name` into { text, target }. */
function parseWikiLink(inner: string): { text: string; target: string } {
	const [first, second] = inner.split('|');
	return second !== undefined ? { text: first.trim(), target: second.trim() } : { text: first.trim(), target: first.trim() };
}

/** Rewrites [[Page Name]] and [[Link Text|Page Name]] to /docs/Page-Name. */
function rewriteWikiLinks(content: string): string {
	return content.replace(/\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
		const { text, target } = parseWikiLink(inner);
		return `[${text}](/${toSlug(target)})`;
	});
}

function titleFromName(name: string): string {
	return name.replace(/-/g, ' ').trim();
}

interface SidebarLine {
	indent: number;
	label: string;
	slug: string | null;
}

/** Turns a markdown bullet line into a label + optional wiki-link slug. */
function parseSidebarLine(line: string): SidebarLine | null {
	const match = line.match(/^(\s*)[-*]\s+(.*)$/);
	if (!match) return null;

	const indent = match[1].length;
	const text = match[2].trim();
	const linkMatch = text.match(/^\[\[([^\]]+)\]\]$/);
	if (linkMatch) {
		const { text: label, target } = parseWikiLink(linkMatch[1]);
		return { indent, label, slug: toSlug(target) };
	}
	return { indent, label: text, slug: null };
}

/**
 * Parses a GitHub-wiki-style `_Sidebar.md` into a nav tree, preserving
 * indentation as grouping: an unlinked bullet with more-indented bullets
 * beneath it becomes a group.
 */
function parseSidebar(sidebarContent: string): NavEntry[] {
	const lines = sidebarContent
		.split('\n')
		.map(parseSidebarLine)
		.filter((line): line is SidebarLine => line !== null);

	function build(startIndent: number, cursor: { i: number }): NavEntry[] {
		const entries: NavEntry[] = [];
		while (cursor.i < lines.length && lines[cursor.i].indent >= startIndent) {
			const line = lines[cursor.i];
			if (line.indent > startIndent) {
				// Orphaned deeper indent with no parent group; attach at this level.
				cursor.i += 1;
				continue;
			}
			cursor.i += 1;
			const childIndent = lines[cursor.i]?.indent ?? -1;
			if (childIndent > line.indent) {
				entries.push({ label: line.label, items: build(childIndent, cursor) });
			} else if (line.slug) {
				entries.push({ label: line.label, slug: line.slug });
			} else {
				entries.push({ label: line.label, items: [] });
			}
		}
		return entries;
	}

	return build(lines[0]?.indent ?? 0, { i: 0 });
}

function alphabeticalNav(pages: WikiPage[]): NavEntry[] {
	return pages
		.map((page) => ({ label: titleFromName(page.name), slug: toSlug(page.name) }))
		.sort((a, b) => a.label.localeCompare(b.label));
}

export function convertWiki(pages: WikiPage[]): ConvertResult {
	const sidebarPage = pages.find((page) => page.name === SIDEBAR_NAME);
	const contentPages = pages.filter((page) => page.name !== SIDEBAR_NAME);

	const converted: ConvertedPage[] = contentPages.map((page) => ({
		slug: toSlug(page.name),
		title: titleFromName(page.name),
		body: rewriteWikiLinks(page.content),
	}));

	const nav = sidebarPage ? parseSidebar(sidebarPage.content) : alphabeticalNav(contentPages);

	return { pages: converted, nav };
}
