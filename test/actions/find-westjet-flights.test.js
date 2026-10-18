const test = require('node:test')
const assert = require('node:assert/strict')
const handler = require('../../actions/find-westjet-flights/index.js')

// The handler no longer owns any flight data: it validates and echoes the
// search arguments, and the EDS block fetches live fares from FLYR using them.
// records is therefore always [] (the shape is kept stable for the block).

test('content[0] is a text item', async () => {
    const res = await handler({ origin: 'YYZ' })
    assert.equal(res.content[0].type, 'text')
    assert.equal(typeof res.content[0].text, 'string')
    assert.deepEqual(Object.keys(res.content[0]).sort(), ['text', 'type'])
})

test('structuredContent echoes arguments and returns no records', async () => {
    const res = await handler({ origin: 'YYZ', destination: 'CUN', adult_count: 2 })
    assert.deepEqual(res.structuredContent.arguments, { origin: 'YYZ', destination: 'CUN', adult_count: 2 })
    assert.deepEqual(res.structuredContent.records, [])
    assert.deepEqual(Object.keys(res.structuredContent).sort(), ['arguments', 'records'])
})

test('empty call returns empty arguments and no records', async () => {
    const res = await handler({})
    assert.deepEqual(res.structuredContent, { arguments: {}, records: [] })
    const res2 = await handler()
    assert.deepEqual(res2.structuredContent, { arguments: {}, records: [] })
})

test('unknown keys are dropped from arguments', async () => {
    const res = await handler({ origin: 'YYZ', bogus: 1 })
    assert.deepEqual(res.structuredContent.arguments, { origin: 'YYZ' })
})

test('the summary text names the route when provided', async () => {
    const res = await handler({ origin: 'YYZ', destination: 'CUN' })
    assert.match(res.content[0].text, /from YYZ/)
    assert.match(res.content[0].text, /to CUN/)
})

test('wrong type returns empty records and names the param', async () => {
    const res = await handler({ adult_count: 'two' })
    assert.deepEqual(res.structuredContent.records, [])
    assert.match(res.content[0].text, /adult_count/)
    const res2 = await handler({ use_points: 'yes' })
    assert.deepEqual(res2.structuredContent.records, [])
    assert.match(res2.content[0].text, /use_points/)
})
