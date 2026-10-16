const test = require('node:test')
const assert = require('node:assert/strict')

const handler = require('../actions/start-westjet-flight-booking/index.js')
const example = require('../eds/example.json')
const expected = require('../eds/start-westjet-flight-booking.json')
const fixture = require('../fixture.json')

const ALL = fixture.dataset.records

test('example arguments return the canonical tool result', async () => {
    const res = await handler(example.arguments)
    assert.deepEqual(res.structuredContent, expected)
    assert.deepEqual(Object.keys(res.structuredContent).sort(), ['arguments', 'records'])
})

test('content[0] is a text item', async () => {
    const res = await handler(example.arguments)
    assert.equal(res.content[0].type, 'text')
    assert.equal(typeof res.content[0].text, 'string')
    assert.match(res.content[0].text, /simulation/i)
    assert.deepEqual(Object.keys(res.content[0]).sort(), ['text', 'type'])
})

test('missing required flight_option_id returns no records and names the param', async () => {
    const res = await handler({ fare_id: 'econo' })
    assert.deepEqual(res.structuredContent.records, [])
    assert.match(res.content[0].text, /flight_option_id/)
    assert.deepEqual(res.structuredContent.arguments, { fare_id: 'econo' })
    const res2 = await handler()
    assert.deepEqual(res2.structuredContent.records, [])
    assert.match(res2.content[0].text, /flight_option_id/)
})

test('wrong param type returns no records and names the param', async () => {
    const res = await handler({ flight_option_id: 42 })
    assert.deepEqual(res.structuredContent.records, [])
    assert.match(res.content[0].text, /flight_option_id/)
})

test('unknown keys are dropped and known values kept unchanged', async () => {
    const args = { flight_option_id: 'placeholder-2', search_context_id: 'ctx-1', bogus: 1 }
    const res = await handler(args)
    assert.deepEqual(res.structuredContent.arguments, { flight_option_id: 'placeholder-2', search_context_id: 'ctx-1' })
})

test('unbound params are context only and never filter (params_binding is empty)', async () => {
    assert.deepEqual(fixture.action.params_binding, {})
    const res = await handler({
        flight_option_id: 'no-such-option',
        fare_id: 'no-such-fare',
        search_context_id: 'x',
        westjet_rewards_id: 'y',
    })
    assert.deepEqual(res.structuredContent.records, ALL)
    assert.deepEqual(Object.keys(res.structuredContent).sort(), Object.keys(expected).sort())
})

test('comma-separated flight_option_id is accepted and does not filter', async () => {
    const res = await handler({ flight_option_id: `${ALL[0].id},${ALL[1].id}` })
    assert.deepEqual(res.structuredContent.records, ALL)
})

test('records are whole objects from the dataset, in source order', async () => {
    const res = await handler(example.arguments)
    res.structuredContent.records.forEach((r, i) => assert.deepEqual(r, ALL[i]))
})
