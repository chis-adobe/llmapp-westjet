const test = require('node:test')
const assert = require('node:assert/strict')
const handler = require('../../actions/find-westjet-flights/index.js')

// The handler fetches the FLYR lowest-fares table server-side, maps rows to the
// record shape the EDS block renders, and filters by origin/destination. These
// tests stub global.fetch so they never hit the network.

const TABLE = {
    fields: [
        { key: 'web_1', label: 'From', type: 'text' },
        { key: 'web_2', label: 'To', type: 'text' },
        { key: 'web_3', label: 'Dates', type: 'text' },
        { key: 'price', label: 'Price', type: 'price' },
        { key: 'deeplink', label: 'Book', type: 'button' },
    ],
    data: [
        {
            web_1: 'Toronto, Ontario',
            web_2: 'Cancún, Quintana Roo',
            web_3: 'Nov 27 - Dec 10, 2026',
            price: '274 CAD',
            deeplink: 'https://www.westjet.com/en-ca/flights/low-fares?origin=YYZ&destination=CUN&outbounddate=2026-11-27',
        },
        {
            web_1: 'Calgary, Alberta',
            web_2: 'Toronto, Ontario',
            web_3: 'Nov 26 - Dec 2, 2026',
            price: '226 CAD',
            deeplink: 'https://www.westjet.com/en-ca/flights/low-fares?origin=YYC&destination=YYZ&outbounddate=2026-11-26',
        },
    ],
}

function stubFetch(impl) {
    const original = global.fetch
    global.fetch = impl
    return () => { global.fetch = original }
}

function okTable(table = TABLE) {
    return stubFetch(async () => ({ ok: true, json: async () => table }))
}

test('maps a matching row to the record shape', async () => {
    const restore = okTable()
    try {
        const res = await handler({ origin: 'YYZ', destination: 'CUN' })
        assert.equal(res.structuredContent.records.length, 1)
        assert.deepEqual(res.structuredContent.records[0], {
            id: 'YYZ–CUN',
            name: 'Toronto, Ontario → Cancún, Quintana Roo',
            description: 'Nov 27 - Dec 10, 2026',
            price: '274 CAD',
            source_url: 'https://www.westjet.com/en-ca/flights/low-fares?origin=YYZ&destination=CUN&outbounddate=2026-11-27',
            originCode: 'YYZ',
            destCode: 'CUN',
            originCity: 'Toronto, Ontario',
            destCity: 'Cancún, Quintana Roo',
        })
        assert.match(res.content[0].text, /274 CAD/)
    } finally { restore() }
})

test('an unserved origin+destination returns no records and says so', async () => {
    const restore = okTable()
    try {
        const res = await handler({ origin: 'YYC', destination: 'CUN' })
        assert.deepEqual(res.structuredContent.records, [])
        assert.match(res.content[0].text, /doesn't serve YYC → CUN/)
    } finally { restore() }
})

test('accent- and case-insensitive city matching', async () => {
    const restore = okTable()
    try {
        const res = await handler({ origin: 'toronto', destination: 'cancun' })
        assert.equal(res.structuredContent.records.length, 1)
        assert.equal(res.structuredContent.records[0].id, 'YYZ–CUN')
    } finally { restore() }
})

test('no origin/destination returns every mapped fare', async () => {
    const restore = okTable()
    try {
        const res = await handler({})
        assert.equal(res.structuredContent.records.length, 2)
        assert.deepEqual(res.structuredContent.arguments, {})
    } finally { restore() }
})

test('a fetch failure omits records so the block can retry client-side', async () => {
    const restore = stubFetch(async () => { throw new Error('network down') })
    try {
        const res = await handler({ origin: 'YYZ', destination: 'CUN' })
        assert.equal('records' in res.structuredContent, false)
        assert.match(res.content[0].text, /Could not reach/)
    } finally { restore() }
})

test('a non-ok response also omits records', async () => {
    const restore = stubFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    try {
        const res = await handler({ origin: 'YYZ' })
        assert.equal('records' in res.structuredContent, false)
    } finally { restore() }
})

test('invalid argument type returns [] and names the param without fetching', async () => {
    let called = false
    const restore = stubFetch(async () => { called = true; return { ok: true, json: async () => TABLE } })
    try {
        const res = await handler({ adult_count: 'two' })
        assert.deepEqual(res.structuredContent.records, [])
        assert.match(res.content[0].text, /adult_count/)
        assert.equal(called, false)
    } finally { restore() }
})

test('unknown keys are dropped from echoed arguments', async () => {
    const restore = okTable()
    try {
        const res = await handler({ origin: 'YYZ', bogus: 1 })
        assert.deepEqual(res.structuredContent.arguments, { origin: 'YYZ' })
    } finally { restore() }
})
