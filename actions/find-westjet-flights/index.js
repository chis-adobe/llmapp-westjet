// find-westjet-flights
//
// This action only *collects and echoes* the search arguments. It does not
// fetch flight data. The live results are fetched client-side by the EDS block
// (blocks/find-westjet-flights) directly from the FLYR lowest-fares table,
// because that table is a browser-friendly, origin-open JSON endpoint and the
// block renders the results widget. The LLM therefore receives the captured
// arguments (so it can confirm the search back to the user); the widget shows
// the actual fares.

const PARAMS = [
    { name: 'origin', type: 'string', required: false },
    { name: 'destination', type: 'string', required: false },
    { name: 'departure_date', type: 'string', required: false },
    { name: 'return_date', type: 'string', required: false },
    { name: 'trip_type', type: 'string', required: false },
    { name: 'adult_count', type: 'integer', required: false },
    { name: 'use_points', type: 'boolean', required: false },
]

function typeOk(type, value) {
    if (type === 'string') return typeof value === 'string'
    if (type === 'integer') return typeof value === 'number' && Number.isInteger(value)
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
    if (type === 'boolean') return typeof value === 'boolean'
    return true
}

function result(text, known) {
    return {
        content: [{ type: 'text', text }],
        // records is intentionally empty: the EDS block fetches live fares from
        // FLYR using these arguments. Keeping the shape stable means the block's
        // live path can still read structuredContent.arguments.
        structuredContent: { arguments: known, records: [] },
    }
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
            return result(`Missing required parameter: ${p.name}.`, known)
        }
        if (known[p.name] !== undefined && !typeOk(p.type, known[p.name])) {
            return result(`Invalid parameter ${p.name}: expected ${p.type}.`, known)
        }
    }

    const parts = []
    if (known.origin) parts.push(`from ${known.origin}`)
    if (known.destination) parts.push(`to ${known.destination}`)
    const route = parts.length ? ` ${parts.join(' ')}` : ''
    return result(`Searching WestJet flights${route}.`, known)
}
