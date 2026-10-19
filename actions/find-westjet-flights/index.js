// find-westjet-flights
//
// Fetches live fares from the FLYR lowest-fares table (xCheck v2 Tables API)
// server-side and returns them as records, so the result renders in any MCP
// host without the widget needing its own (CSP/sandbox-restricted) network
// access. The EDS block renders these records directly in the LLM path and
// only fetches client-side for its own direct-web/preview form.
//
// The table is a fixed deals table, not a live shopping API: only
// origin/destination filter it; dates/pax/points/trip type are context only.

const FLYR_BASE = 'https://westjet-api.xcheck.co'
const FLYR_TABLE_ID = '13664f55-01cb-4ed2-a752-d83228e33207'
const FLYR_URL = `${FLYR_BASE}/v2/tables/${FLYR_TABLE_ID}`

// Only origin/destination are inputs: the table is a fixed lowest-fares list,
// not a date/pax-aware search. (The tool's public input schema lives in the
// Adobe LLM Apps UI / actions.json; unknown keys are dropped here regardless.)
const PARAMS = [
    { name: 'origin', type: 'string', required: false },
    { name: 'destination', type: 'string', required: false },
]

function typeOk(type, value) {
    if (type === 'string') return typeof value === 'string'
    if (type === 'integer') return typeof value === 'number' && Number.isInteger(value)
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
    if (type === 'boolean') return typeof value === 'boolean'
    return true
}

function hasText(value) {
    return value !== undefined && value !== null && String(value).trim() !== ''
}

function priceValue(record) {
    if (!record || record.price === undefined || record.price === null) return Number.POSITIVE_INFINITY
    const n = Number(String(record.price).replace(/[^\d.]/g, ''))
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

function decodeEntities(value) {
    if (!hasText(value)) return ''
    return String(value)
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
}

function codesFromDeeplink(url) {
    try {
        const u = new URL(url, FLYR_BASE)
        return {
            origin: (u.searchParams.get('origin') || '').trim().toUpperCase(),
            destination: (u.searchParams.get('destination') || '').trim().toUpperCase(),
        }
    } catch (err) {
        return { origin: '', destination: '' }
    }
}

// Lower-case and strip diacritics so "Cancun" matches "Cancún", etc.
function normalize(value) {
    return String(value).trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function matchLocation(arg, code, city) {
    if (!hasText(arg)) return true
    const a = normalize(arg)
    if (code && a === code.toLowerCase()) return true
    return Boolean(city) && normalize(city).includes(a)
}

// Map one raw FLYR row to the record shape the EDS card renderer expects.
function mapRow(row, index) {
    const fromCity = decodeEntities(row.web_1)
    const toCity = decodeEntities(row.web_2)
    const dates = decodeEntities(row.web_3)
    const codes = codesFromDeeplink(row.deeplink)
    const code = codes.origin && codes.destination ? `${codes.origin}–${codes.destination}` : ''
    return {
        id: code || `fare-${index + 1}`,
        name: fromCity && toCity ? `${fromCity} → ${toCity}` : fromCity || toCity,
        description: dates,
        price: hasText(row.price) ? decodeEntities(row.price) : null,
        source_url: hasText(row.deeplink) ? String(row.deeplink) : null,
        originCode: codes.origin,
        destCode: codes.destination,
        originCity: fromCity,
        destCity: toCity,
    }
}

async function fetchFlyrRecords() {
    const response = await fetch(FLYR_URL, { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`FLYR responded ${response.status}`)
    const body = await response.json()
    const rows = Array.isArray(body && body.data) ? body.data : []
    return rows.map(mapRow)
}

function result(text, known, records) {
    const structuredContent = { arguments: known }
    // Only include records when we have a definitive answer. Omitting them on a
    // fetch error lets the block fall back to its own client-side fetch.
    if (records !== undefined) structuredContent.records = records
    return { content: [{ type: 'text', text }], structuredContent }
}

module.exports = async (args = {}) => {
    const input = args && typeof args === 'object' ? args : {}
    const known = {}
    for (const p of PARAMS) {
        if (Object.prototype.hasOwnProperty.call(input, p.name) && input[p.name] !== undefined) {
            known[p.name] = input[p.name]
        }
    }

    for (const p of PARAMS) {
        if (p.required && (known[p.name] === undefined || known[p.name] === null || known[p.name] === '')) {
            return result(`Missing required parameter: ${p.name}.`, known, [])
        }
        if (known[p.name] !== undefined && !typeOk(p.type, known[p.name])) {
            return result(`Invalid parameter ${p.name}: expected ${p.type}.`, known, [])
        }
    }

    let records
    try {
        const all = await fetchFlyrRecords()
        records = all.filter((r) => matchLocation(known.origin, r.originCode, r.originCity)
            && matchLocation(known.destination, r.destCode, r.destCity))
        records.sort((a, b) => priceValue(a) - priceValue(b))
    } catch (err) {
        // Leave records undefined so the block can retry client-side.
        return result('Could not reach WestJet fares right now.', known, undefined)
    }

    if (records.length === 0) {
        const route = hasText(known.origin) && hasText(known.destination)
            ? ` WestJet doesn't serve ${known.origin} → ${known.destination} in the current deals.`
            : ''
        return result(`No WestJet fares matched this search.${route}`, known, records)
    }

    const n = records.length
    const summary = records.slice(0, 5)
        .map((r) => `${r.name}${r.price ? ` (${r.price})` : ''}`)
        .join('; ')
    return result(`Found ${n} WestJet fare${n === 1 ? '' : 's'}: ${summary}.`, known, records)
}
