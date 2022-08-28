const plans = {
    'free': {
        hits: 100,
        entries: 10,
        seconds_transcripted: 10*60,
        entries_analysed: 5,
    },
    'starter-v1': {
        hits: 1000,
        entries: 100,
        seconds_transcripted: 60*60,
        entries_analysed: 25,
    },
    'plus-v1': {
        hits: 20000,
        entries: 250,
        seconds_transcripted: 120*60,
        entries_analysed: 75,
    },
    'business-v1': {
        hits: 50000,
        entries: 1000,
        seconds_transcripted: 360*60,
        entries_analysed: 225,
    },
    'basico-v1': {
        hits: 300000,
        entries: 600,
        seconds_transcripted: 150*60,
        entries_analysed: 300,
    },
    'avancado-v1': {
        hits: 600000,
        entries: 1200,
        seconds_transcripted: 300*60,
        entries_analysed: 600,
    },
    'homolog-v1': {
        hits: 100,
        entries: 2,
        seconds_transcripted: 2*60,
        entries_analysed: 2,
    },
}

module.exports = plans;