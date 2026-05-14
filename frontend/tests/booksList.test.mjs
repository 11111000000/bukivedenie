import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildAtlasSummary, buildPunctuationPreview, buildTokenSummary, pickPrimaryTextFile, pickTokensFile } from '../src/views/booksList.js'
import { api } from '../src/api.js'

test('dashboard helpers prefer the canonical token file and summarize rows', () => {
  assert.equal(pickTokensFile(['notes.txt', 'tokens.csv', 'other.csv']), 'tokens.csv')
  assert.equal(pickTokensFile(['chapter_tokens.csv', 'notes.txt']), 'chapter_tokens.csv')
  assert.deepEqual(buildTokenSummary([
    ['alpha', '12'],
    ['beta', 4],
    ['gamma', null],
  ]), [
    { token: 'alpha', count: 12 },
    { token: 'beta', count: 4 },
    { token: 'gamma', count: 0 },
  ])
})

test('dashboard picks the first text-like file for the shared preview', () => {
  assert.equal(pickPrimaryTextFile(['notes.csv', 'chapter-1.txt', 'appendix.md']), 'chapter-1.txt')
  assert.equal(pickPrimaryTextFile(['tables.csv', 'data.json']), '')
})

test('dashboard atlas summary exposes a viewer route and token signal', () => {
  const summary = buildAtlasSummary('book-a', ['chapter-1.txt', 'tokens.csv'], [
    { token: 'alpha', count: 12 },
    { token: 'beta', count: 4 },
  ])

  assert.equal(summary.fileCountText, '2 files available')
  assert.equal(summary.textCountText, '1 text fragment')
  assert.equal(summary.primaryTextFile, 'chapter-1.txt')
  assert.equal(summary.viewerHref, '#/book/book-a/file/chapter-1.txt')
  assert.deepEqual(summary.topToken, { token: 'alpha', count: 12 })
})

test('dashboard punctuation preview normalizes summary rows', () => {
  assert.deepEqual(buildPunctuationPreview([
    { symbol: '.', count: '8' },
    ['!', 3],
    { label: '?', value: 2 },
  ]), [
    { label: '.', count: 8 },
    { label: '!', count: 3 },
    { label: '?', count: 2 },
  ])
})

test('api exposes the dashboard summary endpoint helper', () => {
  assert.equal(typeof api.bookSummary, 'function')
})
