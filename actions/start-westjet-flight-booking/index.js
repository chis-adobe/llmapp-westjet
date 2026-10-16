const DATA = Array.from(require('./data.json'))

const PARAMS = [
    { name: 'flight_option_id', type: 'string', required: true },
    { name: 'fare_id', type: 'string', required: false },
    { name: 'search_context_id', type: 'string', required: false },
    { name: 'westjet_rewards_id', type: 'string', required: false },
]

// params_binding is empty: every param is context only and never filters.
const BINDING = {}

function typeOk(value, type) {
    if (type === 'string') return typeof value === 'string'
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
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

function matchOne(fieldValue, arg) {
    if (fieldValue === undefined || fieldValue === null) return false
    if (Array.isArray(fieldValue)) return fieldValue.some((item) => matchOne(item, arg))
    if (typeof arg === 'number') {
        const n = toNumber(fieldValue)
        return Number.isFinite(n) && n === arg
    }
    if (typeof arg === 'string') {
        const want = arg.trim().toLowerCase()
        const have = String(fieldValue).trim().toLowerCase()
        if (have === want) return true
        return arg.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean).includes(have)
    }
    return fieldValue === arg
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
        const value = known[p.name]
        if (p.required && (value === undefined || value === null || value === '')) {
            return result(`Missing required parameter: ${p.name}.`, known, [])
        }
        if (value !== undefined && value !== null && !typeOk(value, p.type)) {
            return result(`Invalid parameter ${p.name}: expected a ${p.type}.`, known, [])
        }
    }

    let records = DATA
    for (const [param, field] of Object.entries(BINDING)) {
        if (known[param] === undefined || known[param] === null) continue
        records = records.filter((r) => r && matchOne(r[field], known[param]))
    }

    if (records.length === 0) {
        return result('Simulation only: no matching WestJet flight options were found, and no booking was started.', known, [])
    }
    return result(
        `Simulation only: ${records.length} WestJet flight option${records.length === 1 ? '' : 's'} ready to continue into booking; no booking was made.`,
        known,
        records,
    )
}
