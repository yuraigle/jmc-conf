// читаем файл настроек
const botovods = [];
const friendsIme = [];
const friendsVin = [];
const friendsTvo = [];

const iniStream = new ActiveXObject('Scripting.FileSystemObject')
    .GetFile('settings/fighter.ini')
    .OpenAsTextStream(1, -1);

let iniMode = '';
while(!iniStream.AtEndOfStream) {
    let line = iniStream.ReadLine();
    if (line === '' || line.substring(0, 1) === ';') continue;

    if (line.substring(0, 1) === '[') {
        iniMode = line.substring(1, line.length - 1);
        continue;
    }

    if (iniMode === 'СЛУШАЮСЬ') {
        botovods.push(line);
    }

    if (iniMode === 'ПОМОГАЮ') {
        const a = line.split(':');
        friendsIme.push(a[0]);
        friendsVin.push(a[1]);
        friendsTvo.push(a[2]);
    }
}
iniStream.Close();

const attackWeight = [
    'легонько', 'слегка', 'сильно', 'очень сильно', 'чрезвычайно сильно',
    'БОЛЬНО', 'ОЧЕНЬ БОЛЬНО', 'НЕВЫНОСИМО БОЛЬНО', 'ЧРЕЗВЫЧАЙНО БОЛЬНО',
    'УЖАСНО', 'ЖЕСТОКО', 'УБИЙСТВЕННО', 'СМЕРТЕЛЬНО', 'ИЗУВЕРСКИ'
];

const attackType = [
    'боднул[аои]?',   'клюнул[аои]?', 'лягнул[аои]?',  'ободрал[аои]?',  'огрел[аои]?',
    'оцарапал[аои]?', 'пырнул[аои]?', 'резанул[аои]?', 'рубанул[аои]?', 'уколол[аои]?',
    'сокрушил[аои]?', 'ткнул[аои]?',  'ударил[аои]?',  'ужалил[аои]?',   'укусил[аои]?',
    'хлестнул[аои]?', 'подстрелил[аои]?'
];

const friendsRx = new RegExp(friendsIme.join('|'));
const attackRx0 = new RegExp('^(.*?) (' + attackWeight.join('|') + ')? ?(' + attackType.join('|') + ') (.*?)\.( [(][*]+[)])?$');
const attackRx2 = new RegExp('^(.+?) (' + attackWeight.join('|') + ') пнул.? (.+)[.] (Морда|Теперь) ');
const fightRx = new RegExp('^(.+) сражается с (.*?)(, сидя верхом на .+)?! $');

// UTILS
now = function() {
    return Math.floor(+new Date() / 1000);
}

hhmm = function() {
    const dd = new Date();
    let hh = dd.getHours();
    let mm = dd.getMinutes();
    if (hh < 10) { hh = '0' + hh }
    if (mm < 10) { mm = '0' + mm }
    return hh + ':' + mm;
}

in_array = function(arr, needle) {
    for (let i = 0; i < arr.length; i++) {
        if (needle === arr[i]) {
            return true;
        }
    }
    return false;
}

str_trim = function(s) {
    if (!s) { return ''; }
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

strip_colors = function(s) {
    return s.replace(/\x1B\[(\d;)?(\d)+m/g, '');
}

make_alias = function(s) {
    let alias = '';
    let wn = 0;
    const arr = s.toLowerCase().split(/[\s\-,]+/);
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].length >= 3 && wn < 2) {
            alias += alias ? '.' : '';
            alias += arr[i].substr(0, 3);
            wn++;
        }
    }
    return alias ? alias : s;
}
// \UTILS

let myProf = '', myName = '', target1 = '', target0 = '', attack1 = '';
let lastPn = 0, lastSb = 0, lastOg = 0, lastMo = 0,
    lastOtst = 0, lastScor = 0;

jmc.RegisterHandler('Prompt', 'onPrompt()');
onPrompt = function() {
    const lines = jmc.Event;
    const arr = lines.split('\n');
    const promptLine = arr[arr.length - 1];
    const ts = now();

    if (!promptLine.match(/>\s+$/)) { return } // неправильный промт
    const lagOz = promptLine.replace(/^.+ ОЗ:(\d+) .+$/, '$1') != '0' ? 1 : 0;
    const lagPn = promptLine.indexOf(' Пн:') !== -1 ? 1 : 0;
    const lagMo = promptLine.indexOf(' Мо:') !== -1 ? 1 : 0;
    const lagOg = promptLine.indexOf(' Ог:') !== -1 ? 1 : 0;
    const iFight = promptLine.indexOf(']') !== -1 ? 1 : 0;

    if ((!myName || !myProf) && ts - lastScor > 4) {
        jmc.parse('сч все');
        lastScor = ts;
        return;
    }

    // если я только что отступил, не лезу в бой. ещё 5 секунд.
    if (lines.indexOf('Вы отступили из битвы.') >= 0) { lastOtst = ts; }
    if (ts - lastOtst < 5) { return; }

    // если я в бою пинаюсь, продолжаю пинаться
    if (iFight && !lagOz && !lagMo && attack1 === 'моло' && ts - lastMo > 0) {
        jmc.parse('моло');
        lastMo = ts;
        return;
    }
    if (iFight && !lagOz && !lagPn && attack1 === 'пнут' && ts - lastPn > 0) {
        jmc.parse('пнут ' + target0);
        lastPn = ts;
        return;
    }
    if (iFight && !lagOz && !lagOg && attack1 === 'оглу' && ts - lastOg > 0) {
        jmc.parse('оглу ' + target0);
        lastOg = ts;
        return;
    }
    if (iFight && attack1 === 'сбит' && ts - lastSb > 0) {
        jmc.parse('сбит ' + target0);
        lastSb = ts;
        return;
    }

    if (iFight) { return }
    if (target0 && target0.match(/^\./)) { return }

    let trgIme = '';
    let trgAny = '';
    for (let i = 0; i < arr.length - 1; i++) {
        const str = strip_colors(arr[i]);

        if (str.match(/ душа медленно подымается в небеса\.$/) ||
            str.match(/ вспыхнул.? и рассыпал.?с. в прах\.$/)
        ) {
            jmc.parse('см');
            return;
        }

        // [Злой враг] БОЛЬНО ударил Дремира => зло.вра
        const cc0 = str.match(attackRx0);
        if (cc0) {
            const ime = cc0[1];
            const vin = cc0[4];
            if (!trgIme && in_array(friendsVin, vin)) {
                trgIme = make_alias(ime)
            } else if (!trgAny && in_array(friendsIme, ime)) {
                trgAny = make_alias(vin);
            }
        }

        // Дремир сражается с [злым врагом] => злы.вра
        const cc1 = str.match(fightRx);
        if (cc1) {
            const ime = cc1[1];
            const tvo = cc1[2];
            if (!trgIme && in_array(friendsTvo, tvo)) {
                trgIme = make_alias(ime);
            } else if (!trgAny && ime.match(friendsRx)) {
                trgAny = make_alias(tvo);
            }
        }

        // Дремир пнул [злого врага]. Теперь морда ...
        const cc2 = str.match(attackRx2);
        if (cc2) {
            const ime = cc2[1];
            const vin = cc2[3];
            if (!trgIme && in_array(friendsVin, vin)) {
                trgIme = make_alias(ime);
            } else if (!trgAny && ime.match(friendsRx)) {
                trgAny = make_alias(vin);
            }
        }
    }

    const trg0 = trgIme ? trgIme : trgAny;

    if (trg0) {
        if (attack1 === 'пнут' && !lagPn && !lagOz) {
            jmc.parse('пнут ' + trg0);
        } else if (attack1 === 'оглу' && !lagOg && !lagOz) {
            jmc.parse('оглу ' + trg0);
        } else if (attack1 === 'моло' && !lagMo && !lagOz) {
            jmc.parse('моло ' + trg0);
        } else if (attack1 === 'сбит') {
            jmc.parse('сбит ' + trg0);
        } else {
            jmc.parse('убит ' + trg0);
        }
    }
}

const registeredTriggers = [];
trig = (rx, cb, blocking = 1) => registeredTriggers.push({ rx, cb, blocking });

const registeredAliases = [];
alias = (syn, cb) => registeredAliases.push({ syn, cb });

jmc.RegisterHandler('Incoming', 'onIncoming()');
onIncoming = function() {
    const line = jmc.Event;
    for (let i = 0; i < registeredTriggers.length; i++) {
        const trg = registeredTriggers[i];
        const arr = line.match(trg.rx);
        if (arr) {
            trg.cb(arr);
            if (trg.blocking) {
                return;
            }
        }
    }
}

jmc.RegisterHandler('Input', 'onInput()');
onInput = function() {
    const str = str_trim(jmc.Event);
    const n = str.indexOf(' ');
    const p1 = n >= 0 ? str.substring(0, str.indexOf(' ')) : str;
    const p2 = n >= 0 ? str.substring(str.indexOf(' ') + 1) : '';

    for (let i = 0; i < registeredAliases.length; i++) {
        const s = registeredAliases[i];
        if (p1 === s.syn) {
            s.cb(p2);
            jmc.Event = false;
            return;
        }
    }
}

cmd = (s) => {
    const str = str_trim(s);
    const n = str.indexOf(' ');
    const p1 = n >= 0 ? str.substring(0, str.indexOf(' ')) : str;
    const p2 = n >= 0 ? str.substring(str.indexOf(' ') + 1) : '';

    for (let i = 0; i < registeredAliases.length; i++) {
        const s = registeredAliases[i];
        if (p1 === s.syn) {
            s.cb(p2);
            return;
        }
    }

    jmc.parse(str);
}

// Ботовод
trig(/^([А-Я][а-я]+) сообщила? группе : '([А-Я][а-я]+) (.+)'/, (aa) => {
    if (in_array(botovods, aa[1]) && aa[2] === myName) cmd(aa[3]);
}, 0);
trig(/^([А-Я][а-я]+) сообщила? группе : '!(.+)'/, (aa) => {
    if (in_array(botovods, aa[1])) cmd(aa[2]);
}, 0);
trig(/^\x1B\[1;30m([А-Я][а-я]+) сообщила? группе : '([А-Я][а-я]+) (.+)'/, (aa) => {
    if (in_array(botovods, aa[1]) && aa[2] === myName) cmd(aa[3]);
}, 0);
trig(/^\x1B\[1;30m([А-Я][а-я]+) сообщила? группе : '!(.+)'/, (aa) => {
    if (in_array(botovods, aa[1])) cmd(aa[2]);
}, 0);

// бьем по цели
trig(/^:.+@/, () => {
    if (target0) { jmc.parse(attack1 + ' ' + target0); }
});
trig(/^([А-Я][а-я]+) при.+ с.+\.$/, (aa) => {
    if (target0 && target1 === aa[1]) { jmc.parse(attack1 + ' ' + target0); }
});
trig(/^([А-Я][а-я]+) появил.?с. из пентаграммы\.$/, (aa) => {
    if (target0 && target1 === aa[1]) { jmc.parse(attack1 + ' ' + target0); }
});
trig(/^([А-Я][а-я]+) прибыл.? по вызову\.$/, (aa) => {
    if (target0 && target1 === aa[1]) { jmc.parse(attack1 + ' ' + target0); }
});
trig(/^([А-Я][а-я]+) медленно появил.?с. откуда-то\.$/, (aa) => {
    if (target0 && target1 === aa[1]) { jmc.parse(attack1 + ' ' + target0); }
});

trig(/^ \|\| \x1B\[0;37mВы ([А-Я][а-я]+), ([а-я]+)\. +\x1B\[0;36m\|\|$/, (aa) => {
    if (!myName || !myProf) {
        myName = aa[1];
        myProf = aa[2];

        if (myProf === 'охотник' || myProf === 'витязь') {
            myMode = 'двуруч';
            attack1 = 'пнут';
        }
        if (myProf === 'кузнец') {
            myMode = 'двуруч';
            attack1 = 'оглу';
        }
        if (myProf === 'богатырь') {
            myMode = 'молот';
            attack1 = 'моло';
        }
    }
});

trig(/^Вы взяли .+ в обе руки\.$/, () => {
    if (myProf === 'богатырь') {
        myMode = 'двуруч';
        attack1 = 'оглу';
    }
});

trig(/^Вы прекратили использовать .*(двуручн|дубину|молот).*\.$/, () => {
    if (myProf === 'богатырь') {
        myMode = 'молот';
        attack1 = 'моло';
    }
});

alias('ц1', (s) => { set_target1(s); say_target1() });
alias('ц0', () => { set_target1(''); say_target1() });
alias('долц', () => say_target1());
alias('двур', () => { set_mode_two_handed() } );
alias('двуруч', () => { set_mode_two_handed() } );
alias('башмод', () => { set_mode_bash() } );
alias('щит', () => { set_mode_bash() } );
alias('баш', (s) => { set_target1(s); set_mode_bash(); say_target1() } );

set_target1 = function(s) {
    target1 = s;

    if (s.match(/^[А-Я]/)) {
        target0 = '.' + target1;
    } else {
        target0 = target1;
    }
}

say_target1 = function() {
    if (target1 && target1.match(/^[А-Я]/)) {
        jmc.parse('гг моя цель: ' + target1 + ' (игрок), использую ' + attack1);
    } else if (target1) {
        jmc.parse('гг моя цель: ' + target1 + ', использую ' + attack1);
    } else {
        jmc.parse('гг нет цели! помогаю танку, использую ' + attack1);
    }
}

let myMode = '';
set_mode_two_handed = function() {
    const n = myName.toUpperCase();
    if (myProf === 'витязь') {
        jmc.parse('сн ' + n + '.ЩИТ;сн ' + n + '.ПРАЙМ;сн ' + n + '.ОФФ;сн ' + n + '.СВЕТ;воор ' + n + '.ДВУРУЧ обе');
        myMode = 'двуруч';
        attack1 = 'пнут';
    }
    if (myProf === 'кузнец' || myProf === 'богатырь') {
        jmc.parse('сн ' + n + '.ЩИТ;сн ' + n + '.ПРАЙМ;сн ' + n + '.ОФФ;сн ' + n + '.СВЕТ;воор ' + n + '.ДВУРУЧ обе');
        myMode = 'двуруч';
        attack1 = 'оглу';
    }
    if (myProf === 'охотник') {
        jmc.parse('сн ' + n + '.ЩИТ;сн ' + n + '.ПРАЙМ;сн ' + n + '.ОФФ;сн ' + n + '.СВЕТ;воор ' + n + '.ЛУК обе');
        myMode = 'двуруч';
        attack1 = 'пнут';
    }
}

set_mode_bash = function() {
    const n = myName.toUpperCase();
    if (myProf === 'витязь' || myProf === 'кузнец') {
        jmc.parse('сн ' + n + '.ДВУРУЧ;сн ' + n + '.ОФФ;наде ' + n + '.ЩИТ щит;воор ' + n + '.ПРАЙМ;держ ' + n + '.СВЕТ');
        jmc.parse('соск;отпу');
        myMode = 'баш';
        attack1 = 'сбит';
    }
    if (myProf === 'охотник') {
        jmc.parse('сн ' + n + '.ЛУК;сн ' + n + '.ОФФ;наде ' + n + '.ЩИТ щит;воор ' + n + '.ПРАЙМ;держ ' + n + '.СВЕТ');
        jmc.parse('соск;отпу');
        myMode = 'баш';
        attack1 = 'сбит';
    }
}

trig(/^Вы (зачитали|осушили) /, () => {
    const n = myName.toUpperCase();
    if (myMode === 'двуруч' && myProf === 'охотник') {
        jmc.parse('воор ' + n + '.ЛУК обе');
    } else if (myMode === 'двуруч' && myProf.match(/витязь|кузнец|богатырь/)) {
        jmc.parse('воор ' + n + '.ДВУРУЧ обе');
    } else if (myMode === 'баш') {
        jmc.parse('наде ' + n + '.ЩИТ щит;держ ' + n + '.СВЕТ');
    }
}, 1);

// layout
trig(/^[А-Я][а-я]+ сообщил.? группе : '.+'$/, (aa) => {
    jmc.woutput(1, '[' + hhmm() + '] ' + aa[0]);
}, 0);
trig(/^[А-Я][а-я]+ дружине: .+$/, (aa) => {
    jmc.woutput(1, '[' + hhmm() + '] ' + aa[0]);
}, 1);
trig(/^[А-Я][а-я]+ союзникам: .+$/, (aa) => {
    jmc.woutput(1, '[' + hhmm() + '] ' + aa[0]);
}, 1);
trig(/^\x1B\[1;36m[А-Я][а-я]+ сказал.? ([А-Я][а-я]+) : .+$/, (aa) => {
    jmc.woutput(1, '[' + hhmm() + '] ' + aa[0]);
}, 1);
trig(/^\x1B\[0;37m[А-Я][а-я]+ сказал.? : .+$/, (aa) => {
    jmc.woutput(1, '[' + hhmm() + '] ' + aa[0]);
}, 1);
trig(/^\x1B\[0;33m[А-Я][а-я]+ заметил.? : .+$/, (aa) => {
    jmc.woutput(1, '[' + hhmm() + '] ' + aa[0]);
}, 1);
trig(/^\x1B\[1;33m[А-Я][а-я]+ закричал.? : .+$/, (aa) => {
    jmc.woutput(1, '[' + hhmm() + '] ' + aa[0]);
}, 1);
trig(/^\x1B\[1;33m[А-Я][а-я]+ заорал.? : .+$/, (aa) => {
    jmc.woutput(1, '[' + hhmm() + '] ' + aa[0]);
}, 1);
trig(/^\x1B\[0;36m\[оффтоп\] [А-Я][а-я]+ : .+$/, (aa) => {
    jmc.woutput(1, '[' + hhmm() + '] ' + aa[0]);
}, 1);
