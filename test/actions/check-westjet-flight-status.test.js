const test = require('node:test')
const assert = require('node:assert/strict')

const handler = require('../actions/check-westjet-flight-status/index.js')
const example = require('../eds/example.json')
const expected = require('../eds/check-westjet-flight-status.json')
const fixture = require('../fixture.json')

const RECORDS = fixture.dataset.records

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
    assert.deepEqual(Object.keys(res).sort(), ['content', 'structuredContent'])
})

test('no required params: an empty call returns every record in source order', async () => {
    const res = await handler({})
    assert.deepEqual(res.structuredContent, { arguments: {}, records: RECORDS })
    const res2 = await handler()
    assert.deepEqual(res2.structuredContent, { arguments: {}, records: RECORDS })
})

test('unbound flight_date is context only and never filters', async () => {
    const res = await handler({ flight_date: '1999-01-01' })
    assert.deepEqual(res.structuredContent, { arguments: { flight_date: '1999-01-01' }, records: RECORDS })
})

test('unknown keys are dropped from arguments', async () => {
    const res = await handler({ flight_date: '2026-10-16', flight_number: 'WS123', foo: 1 })
    assert.deepEqual(res.structuredContent.arguments, { flight_date: '2026-10-16' })
    assert.equal(res.structuredContent.records.length, RECORDS.length)
})

test('wrong type returns empty records naming the param, with the same keys', async () => {
    const res = await handler({ flight_date: 20261016 })
    assert.deepEqual(res.structuredContent.records, [])
    assert.match(res.content[0].text, /flight_date/)
    assert.deepEqual(Object.keys(res.structuredContent).sort(), Object.keys(expected).sort())
})

test('records are whole objects from the dataset', async () => {
    const res = await handler(example.arguments)
    for (const r of res.structuredContent.records) {
        assert.deepEqual(r, RECORDS.find((x) => x.id === r.id))
    }
})
