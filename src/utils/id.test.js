import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createId } from './id.js'

test('secure origins use the browser UUID implementation', () => {
  const source = { randomUUID() { assert.equal(this, source); return 'native-id' } }
  assert.equal(createId(source), 'native-id')
})

test('HTTP LAN origins generate version-4 UUIDs using available random bytes', () => {
  const source = { getRandomValues(array) { assert.equal(this, source); assert.equal(array.length, 16); return array.fill(255) } }
  assert.equal(createId(source), 'ffffffff-ffff-4fff-bfff-ffffffffffff')
  assert.match(createId({ getRandomValues: array => crypto.getRandomValues(array) }), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
})

test('unsupported browsers receive an actionable error instead of a randomUUID TypeError', () => {
  assert.throws(() => createId({}), /cập nhật trình duyệt/)
})
