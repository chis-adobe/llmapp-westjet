const DATA = Array.from(require('./data.json'))

const PARAMS = [
    { name: 'flight_date', type: 'string', required: false },
]

// action.params_binding is empty: flight_date is context only and never filters.
const BINDING = {}

function typeOk(value, type) {
    if (type === 'string') return typeof value === 'string'
    if (type === 'number' || type === 'integer') return typeof value === 'number' && Number.isFinite(value)
    if (type === 'boolean') return typeof value === 'boolean'
    return true
}

function toNumber(value) {
    if (typeof value === 'number') return value
    if (typeof value !== 'string') return NaN
    let s = value.replace(/[^\d.,-]/g, '')
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
    return s === '' ? NaN : Number(s)
}

function matchOne(fieldValue, argValue) {
    if (fieldValue === undefined || fieldValue === null) return false
    if (Array.isArray(fieldValue)) return fieldValue.some((item) => matchOne(item, argValue))
    if (typeof argValue === 'number') {
        const n = toNumber(fieldValue)
        return !Number.isNaN(n) && n === argValue
    }
    if (typeof argValue === 'boolean') return fieldValue === argValue
    return String(fieldValue).trim().toLowerCase() === String(argValue).trim().toLowerCase()
}

function matches(fieldValue, argValue) {
    if (matchOne(fieldValue, argValue)) return true
    if (typeof argValue === 'string' && argValue.includes(',')) {
        return argValue.split(',').map((s) => s.trim()).filter(Boolean)
            .some((part) => matchOne(fieldValue, part))
    }
    return false
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
        if (known[p.name] !== undefined && known[p.name] !== null && !typeOk(known[p.name], p.type)) {
            return result(`Parameter ${p.name} must be a ${p.type}.`, known, [])
        }
    }

    let records = DATA
    for (const [param, field] of Object.entries(BINDING)) {
        if (known[param] === undefined || known[param] === null || known[param] === '') continue
        records = records.filter((r) => r && matches(r[field], known[param]))
    }

    const text = records.length === 0
        ? 'No WestJet flight status entries matched.'
        : `Found ${records.length} WestJet flight status ${records.length === 1 ? 'entry' : 'entries'}.`
    return result(text, known, records)
}
