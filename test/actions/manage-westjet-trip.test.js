const test = require('node:test')
const assert = require('node:assert/strict')

const handler = require('../actions/manage-westjet-trip/index.js')
const example = require('../eds/example.json')
const expected = require('../eds/manage-westjet-trip.json')
const fixture = require('../fixture.json')

const ALL_IDS = fixture.dataset.records.map((r) => r.id)

test('example arguments reproduce eds/manage-westjet-trip.json exactly', async () => {
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
    const res = await handler({})
    assert.deepEqual(res.structuredContent.arguments, {})
    assert.deepEqual(res.structuredContent.records.map((r) => r.id), ALL_IDS)
})

test('records are whole dataset objects', async () => {
    const res = await handler({})
    assert.deepEqual(res.structuredContent.records, fixture.dataset.records)
})

test('unbound params are context only and never filter', async () => {
    for (const args of [
        { reservation_code: 'ZZZZZZ' },
        { last_name: 'Nobody' },
        { ticket_number: '8382100000000' },
        { reservation_code: 'A,B', last_name: 'x', ticket_number: '1,2' },
    ]) {
        const res = await handler(args)
        assert.deepEqual(res.structuredContent.arguments, args)
        assert.deepEqual(res.structuredContent.records.map((r) => r.id), ALL_IDS)
    }
})

test('unknown keys are dropped from arguments', async () => {
    const res = await handler({ ...example.arguments, foo: 'bar' })
    assert.deepEqual(res.structuredContent, expected)
})

test('wrong type returns records [] naming the param, same keys as example', async () => {
    const res = await handler({ reservation_code: 123456 })
    assert.deepEqual(res.structuredContent.records, [])
    assert.match(res.content[0].text, /reservation_code/)
    assert.deepEqual(Object.keys(res.structuredContent).sort(), Object.keys(expected).sort())
    assert.deepEqual(Object.keys(res).sort(), ['content', 'structuredContent'])
})

test('structuredContent has only arguments and records', async () => {
    const res = await handler({ ticket_number: '123' })
    assert.deepEqual(Object.keys(res.structuredContent).sort(), ['arguments', 'records'])
})
