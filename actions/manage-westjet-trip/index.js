const DATA = Array.from(require('./data.json'))

const PARAMS = [
    { name: 'reservation_code', type: 'string', required: false },
    { name: 'last_name', type: 'string', required: false },
    { name: 'ticket_number', type: 'string', required: false },
]

// params_binding is empty: every param is lookup context only and never filters.
const BINDING = {}

function typeOk(value, type) {
    if (type === 'string') return typeof value === 'string'
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
    if (type === 'boolean') return typeof value === 'boolean'
    return true
}

function reply(text, known, records) {
    return {
        content: [{ type: 'text', text }],
        structuredContent: { arguments: known, records },
    }
}

function norm(v) {
    return String(v).trim().toLowerCase()
}

function matches(fieldValue, arg) {
    if (fieldValue === undefined || fieldValue === null) return false
    const values = Array.isArray(fieldValue) ? fieldValue : [fieldValue]
    const whole = norm(arg)
    const items = String(arg).split(',').map((s) => norm(s)).filter(Boolean)
    return values.some((v) => {
        if (v === undefined || v === null) return false
        const nv = norm(v)
        return nv === whole || items.includes(nv)
    })
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
        const present = Object.prototype.hasOwnProperty.call(known, p.name)
        if (p.required && !present) {
            return reply(`Missing required parameter: ${p.name}.`, known, [])
        }
        if (present && !typeOk(known[p.name], p.type)) {
            return reply(`Invalid parameter ${p.name}: expected a ${p.type}.`, known, [])
        }
    }

    let records = DATA
    for (const [param, field] of Object.entries(BINDING)) {
        if (!Object.prototype.hasOwnProperty.call(known, param)) continue
        records = records.filter((r) => matches(r ? r[field] : undefined, known[param]))
    }

    if (records.length === 0) {
        return reply('No WestJet trip management options matched.', known, [])
    }
    const n = records.length
    return reply(`Found ${n} WestJet trip management option${n === 1 ? '' : 's'}.`, known, records)
}
