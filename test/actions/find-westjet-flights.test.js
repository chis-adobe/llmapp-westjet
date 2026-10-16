const test = require('node:test')
const assert = require('node:assert/strict')
const handler = require('../actions/find-westjet-flights/index.js')
const example = require('../eds/example.json')
const expected = require('../eds/find-westjet-flights.json')
const fixture = require('../fixture.json')

test('example arguments return the canonical tool result (parity)', async () => {
    const res = await handler(example.arguments)
    assert.deepEqual(res.structuredContent, expected)
    assert.deepEqual(res.structuredContent.records.map((r) => r.id), example.record_ids)
})

test('content[0] is a text item', async () => {
    const res = await handler(example.arguments)
    assert.equal(res.content[0].type, 'text')
    assert.equal(typeof res.content[0].text, 'string')
    assert.deepEqual(Object.keys(res.content[0]).sort(), ['text', 'type'])
})

test('no params are required: empty call returns every record in source order', async () => {
    const res = await handler({})
    assert.deepEqual(res.structuredContent, { arguments: {}, records: fixture.dataset.records })
    const res2 = await handler()
    assert.deepEqual(res2.structuredContent.records, fixture.dataset.records)
})

test('unknown keys are dropped from arguments', async () => {
    const res = await handler({ origin: 'YYC', bogus: 1 })
    assert.deepEqual(res.structuredContent.arguments, { origin: 'YYC' })
})

test('unbound params are context only and never filter', async () => {
    const res = await handler({ origin: 'nowhere', destination: 'ZZZ', use_points: true, adult_count: 9 })
    assert.deepEqual(res.structuredContent.records, fixture.dataset.records)
    assert.equal(fixture.action.params_binding && Object.keys(fixture.action.params_binding).length, 0)
})

test('wrong type returns empty records and names the param, with the same keys', async () => {
    const res = await handler({ adult_count: 'two' })
    assert.deepEqual(res.structuredContent.records, [])
    assert.match(res.content[0].text, /adult_count/)
    assert.deepEqual(Object.keys(res.structuredContent).sort(), Object.keys(expected).sort())
    const res2 = await handler({ use_points: 'yes' })
    assert.deepEqual(res2.structuredContent.records, [])
    assert.match(res2.content[0].text, /use_points/)
})

test('records are the original objects from the dataset', async () => {
    const res = await handler({})
    const data = require('../actions/find-westjet-flights/data.json')
    res.structuredContent.records.forEach((r, i) => assert.equal(r, data[i]))
})
