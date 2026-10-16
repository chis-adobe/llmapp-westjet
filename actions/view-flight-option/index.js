const DATA = Array.from(require('./data.json'))

const PARAMS = [
    { name: 'search_context_id', type: 'string', required: false },
]

// params_binding is empty: no param filters records. search_context_id is context only.
const BINDING = {}

function typeOk(value, type) {
    if (type === 'string') return typeof value === 'string'
    if (type === 'number' || type === 'integer') return typeof value === 'number' && Number.isFinite(value)
    if (type === 'boolean') return typeof value === 'boolean'
    if (type === 'array') return Array.isArray(value)
    return true
}

function toNumber(v) {
    if (typeof v === 'number') return v
    if (typeof v !== 'string') return NaN
    let s = v.replace(/[^\d.,-]/g, '')
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
    return s === '' ? NaN : Number(s)
}

function valueMatches(fieldValue, arg) {
    if (fieldValue === undefined || fieldValue === null) return false
    if (Array.isArray(fieldValue)) return fieldValue.some((item) => valueMatches(item, arg))
    if (typeof arg === 'number') return toNumber(fieldValue) === arg
    if (typeof arg === 'string') {
        const field = String(fieldValue).toLowerCase()
        const whole = arg.trim().toLowerCase()
        if (field === whole) return true
        return arg.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean).some((p) => p === field)
    }
    return fieldValue === arg
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
        if (p.required && !(p.name in known)) {
            return {
                content: [{ type: 'text', text: `Missing required parameter: ${p.name}.` }],
                structuredContent: { arguments: known, records: [] },
            }
        }
        if (p.name in known && known[p.name] !== null && !typeOk(known[p.name], p.type)) {
            return {
                content: [{ type: 'text', text: `Invalid parameter ${p.name}: expected ${p.type}.` }],
                structuredContent: { arguments: known, records: [] },
            }
        }
    }

    let records = DATA
    for (const [param, field] of Object.entries(BINDING)) {
        if (!(param in known) || known[param] === null) continue
        records = records.filter((r) => r && valueMatches(r[field], known[param]))
    }

    const n = records.length
    const text = n === 0
        ? 'No flight options found.'
        : `Found ${n} WestJet flight option${n === 1 ? '' : 's'}.`
    return {
        content: [{ type: 'text', text }],
        structuredContent: { arguments: known, records },
    }
}
