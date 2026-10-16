const test = require('node:test')
const assert = require('node:assert/strict')
const handler = require('../actions/view-flight-option/index.js')
const example = require('../eds/example.json')
const expected = require('../eds/view-flight-option.json')
const fixture = require('../fixture.json')

test('example arguments reproduce eds/view-flight-option.json', async () => {
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

test('no required params: empty call returns all records in source order', async () => {
    assert.equal(fixture.action.params.filter((p) => p.required).length, 0)
    const res = await handler()
    assert.deepEqual(res.structuredContent, { arguments: {}, records: fixture.dataset.records })
})

test('unbound search_context_id is context only and never filters', async () => {
    const res = await handler({ search_context_id: 'does-not-match-anything' })
    assert.deepEqual(res.structuredContent.arguments, { search_context_id: 'does-not-match-anything' })
    assert.deepEqual(res.structuredContent.records, fixture.dataset.records)
    assert.deepEqual(Object.keys(res.structuredContent).sort(), Object.keys(expected).sort())
})

test('unknown keys are dropped from arguments', async () => {
    const res = await handler({ search_context_id: 'x', bogus: 1 })
    assert.deepEqual(res.structuredContent.arguments, { search_context_id: 'x' })
})

test('wrong type for search_context_id returns empty records naming the param', async () => {
    const res = await handler({ search_context_id: 42 })
    assert.deepEqual(res.structuredContent.records, [])
    assert.deepEqual(Object.keys(res.structuredContent).sort(), Object.keys(expected).sort())
    assert.match(res.content[0].text, /search_context_id/)
})

test('records are whole objects from the dataset', async () => {
    const res = await handler(example.arguments)
    res.structuredContent.records.forEach((r, i) => assert.deepEqual(r, fixture.dataset.records[i]))
})
