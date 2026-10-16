const test = require('node:test')
const assert = require('node:assert/strict')
const handler = require('../actions/check-in-for-westjet-flight/index.js')
const example = require('../eds/example.json')
const expected = require('../eds/check-in-for-westjet-flight.json')
const fixture = require('../fixture.json')

const DATA = fixture.dataset.records

test('example arguments return the canonical tool result', async () => {
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

test('no required params: an empty call returns every record in source order', async () => {
    assert.equal(fixture.action.params.filter((p) => p.required).length, 0)
    const res = await handler({})
    assert.deepEqual(res.structuredContent, { arguments: {}, records: DATA })
})

test('unbound params are context only and never filter', async () => {
    for (const [k, v] of [['reservation_code', 'ZZZZZZ'], ['ticket_number', '8382100000000'], ['last_name', 'Nobody']]) {
        const res = await handler({ [k]: v })
        assert.deepEqual(res.structuredContent, { arguments: { [k]: v }, records: DATA })
    }
})

test('a non-matching call keeps the same top-level keys', async () => {
    const res = await handler({ reservation_code: 'NOPE00', last_name: 'X' })
    assert.deepEqual(Object.keys(res).sort(), ['content', 'structuredContent'])
    assert.deepEqual(Object.keys(res.structuredContent).sort(), Object.keys(expected).sort())
})

test('unknown keys are dropped from arguments', async () => {
    const res = await handler({ last_name: 'Tremblay', foo: 'bar' })
    assert.deepEqual(res.structuredContent.arguments, { last_name: 'Tremblay' })
})

test('wrong param type returns no records and names the param', async () => {
    const res = await handler({ ticket_number: 8382100000000 })
    assert.deepEqual(res.structuredContent.records, [])
    assert.match(res.content[0].text, /ticket_number/)
})

test('records are whole dataset objects', async () => {
    const res = await handler({})
    res.structuredContent.records.forEach((r, i) => assert.deepEqual(r, DATA[i]))
})
