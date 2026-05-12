import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ROUTES, routeUrl, slugify } from '../../scripts/ui_smoke.mjs'

test('smoke route manifest stays stable', () => {
  assert.ok(ROUTES.length >= 5)
  assert.equal(slugify('Heatmap / token × chapter'), 'heatmap-token-chapter')
  assert.equal(routeUrl('http://127.0.0.1:8000', ROUTES[0], 'book-a', 'file.csv'), 'http://127.0.0.1:8000/#/books')
})
