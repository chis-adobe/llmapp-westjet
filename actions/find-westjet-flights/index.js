const DATA = Array.from(require('./data.json'))

const PARAMS = [
    { name: 'origin', type: 'string', required: false },
    { name: 'destination', type: 'string', required: false },
    { name: 'departure_date', type: 'string', required: false },
    { name: 'return_date', type: 'string', required: false },
    { name: 'trip_type', type: 'string', required: false },
    { name: 'adult_count', type: 'integer', required: false },
    { name: 'use_points', type: 'boolean', required: false },
]

// action.params_binding is empty: every param is context only and never filters.
const BINDING = {}

function typeOk(type, value) {
    if (type === 'string') return typeof value === 'string'
    if (type === 'integer') return typeof value === 'number' && Number.isInteger(value)
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
    if (type === 'boolean') return typeof value === 'boolean'
    return true
}

function parseNumber(value) {
    if (typeof value === 'number') return value
    if (typeof value !== 'string') return NaN
    let s = value.replace(/[^\d.,-]/g, '')
    if (s.includes(',') && s.includes('.')) {
        s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
    } else if (s.includes(',')) {
        s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '')
    }
    return s === '' ? NaN : Number(s)
}

function scalarMatches(fieldValue, arg) {
    if (fieldValue === undefined || fieldValue === null) return false
    if (typeof arg === 'number') return parseNumber(fieldValue) === arg
    if (typeof arg === 'boolean') return fieldValue === arg
    const a = String(arg).trim().toLowerCase()
    const f = String(fieldValue).trim().toLowerCase()
    if (f === a) return true
    return String(arg).split(',').map((p) => p.trim().toLowerCase()).filter(Boolean).includes(f)
}

function fieldMatches(fieldValue, arg) {
    if (Array.isArray(fieldValue)) return fieldValue.some((v) => scalarMatches(v, arg))
    return scalarMatches(fieldValue, arg)
}

function result(text, known, records) {
    return {
        content: [{ type: 'text', text }],
        structuredContent: { arguments: known, records },
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
            return result(`Missing required parameter: ${p.name}.`, known, [])
        }
        if (known[p.name] !== undefined && !typeOk(p.type, known[p.name])) {
            return result(`Invalid parameter ${p.name}: expected ${p.type}.`, known, [])
        }
    }

    let records = DATA
    for (const [param, field] of Object.entries(BINDING)) {
        if (known[param] === undefined || known[param] === null) continue
        records = records.filter((r) => r && fieldMatches(r[field], known[param]))
    }

    if (records.length === 0) return result('No WestJet flight options matched this search.', known, [])
    const n = records.length
    return result(`Found ${n} WestJet flight option${n === 1 ? '' : 's'}.`, known, records)
}
