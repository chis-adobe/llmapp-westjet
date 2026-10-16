const DATA = Array.from(require('./data.json'))

const PARAMS = [
    { name: 'reservation_code', type: 'string', required: false },
    { name: 'ticket_number', type: 'string', required: false },
    { name: 'last_name', type: 'string', required: false },
]

// action.params_binding is empty: every param is context only and never filters.
const BINDING = {}

function typeOk(value, type) {
    if (type === 'string') return typeof value === 'string'
    if (type === 'number' || type === 'integer') return typeof value === 'number' && Number.isFinite(value)
    if (type === 'boolean') return typeof value === 'boolean'
    if (type === 'array') return Array.isArray(value)
    return true
}

function parseNumber(value) {
    if (typeof value === 'number') return value
    if (typeof value !== 'string') return NaN
    let s = value.replace(/[^0-9.,-]/g, '')
    if (s.includes(',') && s.includes('.')) {
        s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
    } else if (s.includes(',')) {
        s = s.replace(',', '.')
    }
    return s === '' ? NaN : Number(s)
}

function valueMatches(fieldValue, arg) {
    if (fieldValue === undefined || fieldValue === null) return false
    if (Array.isArray(fieldValue)) return fieldValue.some((item) => valueMatches(item, arg))
    if (typeof arg === 'number') return parseNumber(fieldValue) === arg
    if (typeof arg === 'string') {
        const field = String(fieldValue).trim().toLowerCase()
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
        if (Object.prototype.hasOwnProperty.call(input, p.name) && input[p.name] !== undefined) known[p.name] = input[p.name]
    }

    for (const p of PARAMS) {
        if (p.required && !(p.name in known)) {
            return {
                content: [{ type: 'text', text: `Missing required parameter: ${p.name}.` }],
                structuredContent: { arguments: known, records: [] },
            }
        }
        if (p.name in known && !typeOk(known[p.name], p.type)) {
            return {
                content: [{ type: 'text', text: `Parameter ${p.name} must be a ${p.type}.` }],
                structuredContent: { arguments: known, records: [] },
            }
        }
    }

    let records = DATA
    for (const [param, field] of Object.entries(BINDING)) {
        if (!(param in known) || known[param] === null) continue
        records = records.filter((r) => r && valueMatches(r[field], known[param]))
    }

    const text = records.length
        ? `Found ${records.length} WestJet check-in option${records.length === 1 ? '' : 's'}; check-in itself is completed on WestJet.`
        : 'No WestJet check-in options matched.'
    return {
        content: [{ type: 'text', text }],
        structuredContent: { arguments: known, records },
    }
}
