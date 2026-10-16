const test = require('node:test')
const assert = require('node:assert/strict')

const handler = require('../actions/compare-westjet-fares/index.js')
const example = require('../eds/example.json')
const expected = require('../eds/compare-westjet-fares.json')
const DATA = require('../actions/compare-westjet-fares/data.json')

const ids = (res) => res.structuredContent.records.map((r) => r.id)

test('example arguments reproduce eds/compare-westjet-fares.json', async () => {
    const res = await handler(example.arguments)
    assert.deepEqual(res.structuredContent, expected)
    assert.deepEqual(ids(res), example.record_ids)
})

test('content[0] is a text item', async () => {
    const res = await handler(example.arguments)
    assert.equal(res.content[0].type, 'text')
    assert.equal(typeof res.content[0].text, 'string')
    assert.deepEqual(Object.keys(res.content[0]).sort(), ['text', 'type'])
})

test('no required params: empty call returns all records', async () => {
    const res = await handler({})
    assert.deepEqual(res.structuredContent, { arguments: {}, records: DATA })
})

test('unknown keys are dropped and context param kept unchanged', async () => {
    const res = await handler({ first_fare_id: 'UltraBasic', search_context_id: 'ctx-1', foo: 1 })
    assert.deepEqual(res.structuredContent.arguments, { first_fare_id: 'UltraBasic', search_context_id: 'ctx-1' })
    assert.equal(res.structuredContent.records.length, DATA.length)
})

test('wrong type names the param', async () => {
    const res = await handler({ first_fare_id: 5 })
    assert.deepEqual(res.structuredContent.records, [])
    assert.match(res.content[0].text, /first_fare_id/)
})

test('candidate mode: first ID alone returns records unfiltered', async () => {
    const res = await handler({ first_fare_id: 'Business' })
    assert.deepEqual(res.structuredContent.records, DATA)
})

test('unbound params never filter alone (second ID or context only)', async () => {
    assert.deepEqual((await handler({ second_fare_id: 'Econo' })).structuredContent.records, DATA)
    assert.deepEqual((await handler({ search_context_id: 'x' })).structuredContent.records, DATA)
})

test('pair mode returns exactly the pair in given order', async () => {
    const res = await handler({ first_fare_id: 'PremiumFlex', second_fare_id: 'Econo', search_context_id: 's' })
    assert.deepEqual(ids(res), ['fares-5', 'fares-2'])
    assert.deepEqual(res.structuredContent.records[0], DATA[4])
    assert.deepEqual(res.structuredContent.records[1], DATA[1])
    const rev = await handler({ first_fare_id: 'econo', second_fare_id: 'PREMIUMFLEX' })
    assert.deepEqual(ids(rev), ['fares-2', 'fares-5'])
})

test('pair mode: duplicate ID returns empty and names it', async () => {
    const res = await handler({ first_fare_id: 'Econo', second_fare_id: 'econo' })
    assert.deepEqual(res.structuredContent.records, [])
    assert.match(res.content[0].text, /econo/)
})

test('pair mode: unknown ID returns empty with same keys and names it', async () => {
    const res = await handler({ first_fare_id: 'UltraBasic', second_fare_id: 'Nope' })
    assert.deepEqual(res.structuredContent.records, [])
    assert.match(res.content[0].text, /Nope/)
    assert.deepEqual(Object.keys(res.structuredContent).sort(), Object.keys(expected).sort())
    assert.deepEqual(Object.keys(res).sort(), ['content', 'structuredContent'])
    const res2 = await handler({ first_fare_id: 'Missing', second_fare_id: 'Econo' })
    assert.deepEqual(res2.structuredContent.records, [])
    assert.match(res2.content[0].text, /Missing/)
})
