const WebSocket = require('ws');
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const url = 'ws://127.0.0.1:6006'

const connection = new WebSocket(url)

const subscribeCommand = '{"command": "subscribe", "streams": ["ledger", "consensus", "server"]}'

const phases = ['open', 'establish', 'accepted']

let lastConsensus
let lastUpdate = Math.floor(Date.now() / 1000)

if (!process.env.SMS_API_KEY) {
    console.error("environment variable SMS_API_KEY is missing")
    process.exit(9)
}

if (!process.env.SMS_DESTINATION_NUMBER) {
    console.error("environment variable SMS_DESTINATION_NUMBER is missing")
    process.exit(9)
}

sendSms = (msg) => {
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.open("POST", "https://api.sms.to/sms/send?api_key=" + process.env.SMS_API_KEY + "&to="
        + process.env.SMS_DESTINATION_NUMBER + "&message=" + encodeURIComponent(msg) + "&sender_id=validator");

    xhr.send("");
}

validatePhasesSeq = (consensus) => {

    if (!lastConsensus) {
        if (phases.includes(consensus)) {
            lastConsensus = consensus
            return true
        } else {
            return false
        }
    }
    const result = (consensus == 'accepted' && lastConsensus == 'establish') || (consensus == 'establish' && lastConsensus == 'open')
        || (consensus == 'open' && lastConsensus == 'accepted')

    lastConsensus = consensus

    return result
}

connection.onmessage = msg => {
    const data = JSON.parse(msg.data)
    lastUpdate = Math.floor(Date.now() / 1000)
    switch (data.type) {
        case 'consensusPhase':
            if (!validatePhasesSeq(data.consensus)) {
                sendSms('Abnormal consensus phase, please take a look, NOOOWWWWWW!')
                process.exit(1)
            }
            break
        case 'ledgerClosed':
            const validatedLedgers = data.validated_ledgers
            const rangeCount = (validatedLedgers.match(/-/g) || []).length
            if (rangeCount > 1) {
                sendSms('Some ledgers missing, please take a look, NOOOWWWWWW!')
                process.exit(1)
            }
            break
        case 'serverStatus':
            if (data.server_status !== 'full') {
                // not sure
                // sendSms('not sure')
                // process.exit(1)
            }
            break
    }
}

connection.onopen = e => {
    console.log("connected");
    connection.send(subscribeCommand)
}

setInterval(() => {
    if (Math.floor(Date.now() / 1000) - lastUpdate > 5) {
        sendSms('Validator has not given any sign of life for 5 seconds, plase take a look')
        process.exit(1)
    }
}, 10000)




