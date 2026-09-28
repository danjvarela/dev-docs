import { describe, expect, it } from 'vitest';
import { convertWiki } from './wiki-convert';

describe('convertWiki', () => {
	it('converts a page into an astro content entry', () => {
		const result = convertWiki([{ name: 'Getting-Started', content: 'Hello world' }]);

		expect(result.pages).toEqual([
			{ slug: 'docs/Getting-Started', title: 'Getting Started', body: 'Hello world' },
		]);
	});

	it('rewrites [[Page Name]] links using GitHub wiki slugify', () => {
		const result = convertWiki([
			{ name: 'Home', content: 'See [[Getting Started]] for more.' },
		]);

		expect(result.pages[0].body).toBe('See [Getting Started](/docs/Getting-Started) for more.');
	});

	it('rewrites [[Text|Page Name]] links, keeping display text and preserving case', () => {
		const result = convertWiki([
			{ name: 'Home', content: 'See [[the docs|Getting Started]].' },
		]);

		expect(result.pages[0].body).toBe('See [the docs](/docs/Getting-Started).');
	});

	it('falls back to an alphabetical nav when no _Sidebar.md is present', () => {
		const result = convertWiki([
			{ name: 'Zebra', content: 'z' },
			{ name: 'Apple', content: 'a' },
		]);

		expect(result.nav).toEqual([
			{ label: 'Apple', slug: 'docs/Apple' },
			{ label: 'Zebra', slug: 'docs/Zebra' },
		]);
	});

	it('uses _Sidebar.md verbatim for nav when present, and excludes it from pages', () => {
		const result = convertWiki([
			{ name: 'Zebra', content: 'z' },
			{ name: 'Apple', content: 'a' },
			{ name: '_Sidebar', content: '- [[Zebra]]\n- [[Apple]]' },
		]);

		expect(result.nav).toEqual([
			{ label: 'Zebra', slug: 'docs/Zebra' },
			{ label: 'Apple', slug: 'docs/Apple' },
		]);
		expect(result.pages.map((p) => p.slug)).toEqual(['docs/Zebra', 'docs/Apple']);
	});

	it('turns indented _Sidebar.md bullets into nav groups', () => {
		const result = convertWiki([
			{ name: '_Sidebar', content: '- Guides\n  - [[Getting Started]]\n  - [[Advanced]]\n- [[Home]]' },
		]);

		expect(result.nav).toEqual([
			{
				label: 'Guides',
				items: [
					{ label: 'Getting Started', slug: 'docs/Getting-Started' },
					{ label: 'Advanced', slug: 'docs/Advanced' },
				],
			},
			{ label: 'Home', slug: 'docs/Home' },
		]);
	});

	it('preserves case and does not lowercase slugs', () => {
		const result = convertWiki([{ name: 'CamelCase Page', content: 'x' }]);

		expect(result.pages[0].slug).toBe('docs/CamelCase-Page');
	});
});
