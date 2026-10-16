const DATA = Array.from(require('./data.json'))

const PARAMS = [
    { name: 'first_fare_id', type: 'string', required: false },
    { name: 'second_fare_id', type: 'string', required: false },
    { name: 'search_context_id', type: 'string', required: false },
]

// Stable fare identity used by the comparison flow.
const ID_FIELD = 'fare_id'

function result(text, known, records) {
    return {
        content: [{ type: 'text', text }],
        structuredContent: { arguments: known, records },
    }
}

function norm(value) {
    return String(value).trim().toLowerCase()
}

function findFare(id) {
    const wanted = norm(id)
    return DATA.find((r) => r && r[ID_FIELD] != null && norm(r[ID_FIELD]) === wanted)
}

module.exports = async (args = {}) => {
    const input = args && typeof args === 'object' ? args : {}
    const known = {}
    for (const p of PARAMS) {
        if (Object.prototype.hasOwnProperty.call(input, p.name)) known[p.name] = input[p.name]
    }

    for (const p of PARAMS) {
        const v = known[p.name]
        if (p.required && (v === undefined || v === null || v === '')) {
            return result(`Missing required parameter ${p.name}.`, known, [])
        }
        if (v !== undefined && v !== null && typeof v !== p.type) {
            return result(`Parameter ${p.name} must be a ${p.type}.`, known, [])
        }
    }

    const first = known.first_fare_id
    const second = known.second_fare_id
    const hasFirst = typeof first === 'string' && first.trim() !== ''
    const hasSecond = typeof second === 'string' && second.trim() !== ''

    if (hasFirst && hasSecond) {
        const a = findFare(first)
        if (!a) return result(`Unknown first_fare_id ${first}.`, known, [])
        const b = findFare(second)
        if (!b) return result(`Unknown second_fare_id ${second}.`, known, [])
        if (a === b) {
            return result(`second_fare_id ${second} duplicates first_fare_id; choose a distinct fare.`, known, [])
        }
        return result(`Comparing ${a.name} with ${b.name}.`, known, [a, b])
    }

    // Candidate mode or no fare given: no bound param, so return every fare.
    const records = DATA.slice()
    return result(`Found ${records.length} WestJet fares to compare.`, known, records)
}
