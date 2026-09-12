/* Random Commander — rifatto il 12 settembre 2026.
 *
 * Tre liste: da giocare, in corso, giocati. Un mazzo si sposta toccandolo, e
 * gira in tondo: da giocare -> in corso -> giocati -> da giocare.
 *
 * Il dato salvato e' lo stesso di prima, chiave `sections` nella memoria locale:
 *     { toUse: [{name, colors}], using: [...], used: [...] }
 * dove `colors` sono i nomi colore del CSS ('white', 'blue', 'black', 'red',
 * 'green', oppure ['gray'] per l'incolore) NELL'ORDINE in cui sono stati
 * scelti. L'ordine e' un dato, non una presentazione: «Boros» e' rosso-bianco,
 * non bianco-rosso, ed e' cosi' che va riscritto.
 */

// Numero di build, letto dal ?v= sul tag di questo script.
const APP_BUILD = (() => {
    const src = (document.currentScript && document.currentScript.src) || '';
    const m = src.match(/[?&]v=(\d+)/);
    return m ? m[1] : '?';
})();

// Vero solo dentro il guscio Android, mai in una scheda del browser.
function isCapacitorNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

// GitHub Pages serve l'HTML con dieci minuti di cache e non si possono mandare
// intestazioni proprie. Il `?v=` sui fogli non basta, perche' a leggerlo e'
// l'HTML: se arriva dalla cache si porta dietro i riferimenti vecchi. Qui la
// pagina si controlla da sola: legge il manifesto senza cache e, se e' rimasta
// indietro, si ricarica UNA VOLTA SOLA con la revisione in coda.
function allineaVersione() {
    if (APP_BUILD === '?') return;
    try {
        if (sessionStorage.getItem('rc-riletta') === '1') return;
    } catch (e) {
        return;
    }
    fetch('versione.json?t=' + Date.now(), { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(m => {
            if (!m || !m.rev || String(m.rev) === String(APP_BUILD)) return;
            sessionStorage.setItem('rc-riletta', '1');
            location.replace(location.pathname + '?v=' + m.rev);
        })
        .catch(() => {});
}

// Tutto su una schermata, senza scorrere.
//
// Il numero di mazzi lo decide l'utente e la scala del testo la decide il
// telefono, quindi una taglia fissa non puo' funzionare: si provano taglie
// sempre piu' strette e ci si ferma alla prima che ci sta. Se non basta
// nemmeno la piu' stretta si lascia scorrere, che e' meglio di un'app
// illeggibile.
const TAGLIE = [
    { tasto: 56, nome: 0.95, cella: 108, sezione: 1.15, spazio: 8, bordo: 10 },
    { tasto: 52, nome: 0.9, cella: 98, sezione: 1.1, spazio: 7, bordo: 9 },
    { tasto: 48, nome: 0.85, cella: 90, sezione: 1.05, spazio: 6, bordo: 8 },
    { tasto: 44, nome: 0.8, cella: 84, sezione: 1, spazio: 5, bordo: 7 },
    { tasto: 40, nome: 0.75, cella: 78, sezione: 0.95, spazio: 4, bordo: 6 },
    { tasto: 36, nome: 0.7, cella: 72, sezione: 0.9, spazio: 3, bordo: 5 }
];

function applicaTaglia(t) {
    const s = document.body.style;
    s.setProperty('--altezza-tasto', t.tasto + 'px');
    s.setProperty('--corpo-nome', t.nome + 'rem');
    s.setProperty('--cella-min', t.cella + 'px');
    s.setProperty('--corpo-sezione', t.sezione + 'rem');
    s.setProperty('--spazio-griglia', t.spazio + 'px');
    s.setProperty('--spazio-sezione', t.bordo + 'px');
}

// ⚠️ Misurare col canvas non va bene: disegna col corpo dichiarato, mentre a
// schermo ci finisce anche la scala del testo di sistema. Si misura un pezzo di
// testo vero, messo nella pagina.
let metro = null;

function larghezzaNome(testo, modello) {
    if (!metro) {
        metro = document.createElement('span');
        metro.setAttribute('aria-hidden', 'true');
        metro.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;' +
            'left:-9999px;top:0;padding:0;margin:0;border:0;';
        document.body.appendChild(metro);
    }
    const s = getComputedStyle(modello);
    metro.style.fontFamily = s.fontFamily;
    metro.style.fontSize = s.fontSize;
    metro.style.fontWeight = s.fontWeight;
    metro.style.letterSpacing = s.letterSpacing;
    metro.textContent = testo;
    return metro.getBoundingClientRect().width;
}

// Il nome deve restare intero: era il difetto della versione vecchia, dove
// «Selesnya» diventava «Seles». Scelta la taglia, il corpo del nome scende
// quanto basta perche' il piu' lungo ci stia nella cella.
const CORPO_NOME_MIN = 0.6;

function adattaNomi(taglia) {
    const tasti = document.querySelectorAll('.griglia .name-button');
    if (!tasti.length) return;
    const targa = tasti[0].querySelector('.button-text');
    if (!targa) return;

    const s = getComputedStyle(targa);
    const disponibile = tasti[0].getBoundingClientRect().width
        - 10                                             // margine della targhetta
        - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)
        - 6;                                             // i due bordi del pulsante
    if (disponibile <= 0) return;

    let piuLungo = 0;
    document.querySelectorAll('.griglia .button-text').forEach(t => {
        piuLungo = Math.max(piuLungo, larghezzaNome(t.textContent, t));
    });
    if (piuLungo <= disponibile) return;

    const fattore = Math.max(CORPO_NOME_MIN / taglia.nome, disponibile / piuLungo);
    document.body.style.setProperty('--corpo-nome', (taglia.nome * fattore).toFixed(3) + 'rem');
}

function adattaAllaSchermata() {
    for (let i = 0; i < TAGLIE.length; i++) {
        applicaTaglia(TAGLIE[i]);
        adattaNomi(TAGLIE[i]);
        // Leggere scrollHeight forza il ricalcolo, quindi la misura e' quella
        // della taglia appena messa.
        if (document.documentElement.scrollHeight <= window.innerHeight + 1) return;
    }
}

// Una passata sola non basta: la prima cade prima che il carattere sia pronto e
// prima che il telefono abbia applicato la sua scala del testo.
function pianificaAdatta() {
    [0, 200, 700, 1600].forEach(q => setTimeout(() => requestAnimationFrame(adattaAllaSchermata), q));
}

const COLORI = ['white', 'blue', 'black', 'red', 'green'];
const ETICHETTE = {
    white: 'Bianco',
    blue: 'Blu',
    black: 'Nero',
    red: 'Rosso',
    green: 'Verde'
};

document.addEventListener('DOMContentLoaded', () => {
    if (isCapacitorNative()) document.body.classList.add('capacitor');
    const tag = document.getElementById('build-tag');
    if (tag) tag.textContent = 'v' + APP_BUILD;
    allineaVersione();

    const contenitori = {
        toUse: document.getElementById('to-use'),
        using: document.getElementById('using'),
        used: document.getElementById('used')
    };
    const conteggi = {
        toUse: document.getElementById('conta-to-use'),
        using: document.getElementById('conta-using'),
        used: document.getElementById('conta-used')
    };
    const sezioneColori = document.getElementById('colors-section');
    const contenitoreColori = document.getElementById('color-pulsantes');
    const anteprima = document.getElementById('anteprima');
    const campoNome = document.getElementById('name-input');
    const tastoRandom = document.getElementById('random-button');
    const tastoRefill = document.getElementById('refill-button');
    const tastoEnter = document.getElementById('enter-button');
    const tastoAnnulla = document.getElementById('annulla-button');
    const modi = {
        add: document.getElementById('add-mode'),
        move: document.getElementById('move-mode'),
        delete: document.getElementById('delete-mode')
    };
    const menuButton = document.getElementById('menu-button');
    const menuPanel = document.getElementById('menu-panel');
    const menuChiudi = document.getElementById('menu-chiudi');

    let sezioni = leggiDati();
    let coloriScelti = [];
    let modo = 'move';

    function leggiDati() {
        let dati = null;
        try {
            dati = JSON.parse(localStorage.getItem('sections'));
        } catch (e) {
            dati = null;
        }
        if (!dati || typeof dati !== 'object') dati = {};
        return {
            toUse: Array.isArray(dati.toUse) ? dati.toUse : [],
            using: Array.isArray(dati.using) ? dati.using : [],
            used: Array.isArray(dati.used) ? dati.used : []
        };
    }

    function salva() {
        localStorage.setItem('sections', JSON.stringify(sezioni));
    }

    function maiuscoleIniziali(testo) {
        return testo.replace(/\b\w/g, c => c.toUpperCase());
    }

    function creaPulsante(voce, dove) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'name-button';
        b.title = voce.name;

        const strisce = document.createElement('div');
        strisce.className = 'stripes';
        const colori = (voce.colors && voce.colors.length) ? voce.colors : ['gray'];
        colori.forEach(c => {
            const s = document.createElement('div');
            s.className = 'stripe';
            s.style.backgroundColor = c;
            strisce.appendChild(s);
        });

        const testo = document.createElement('span');
        testo.className = 'button-text';
        testo.textContent = voce.name;

        b.appendChild(strisce);
        b.appendChild(testo);
        b.addEventListener('click', () => tocca(voce, dove));
        return b;
    }

    function disegna() {
        ['toUse', 'using', 'used'].forEach(dove => {
            const c = contenitori[dove];
            c.innerHTML = '';
            if (!sezioni[dove].length) {
                const vuoto = document.createElement('div');
                vuoto.className = 'vuoto';
                vuoto.textContent = '—';
                c.appendChild(vuoto);
            } else {
                sezioni[dove].forEach(voce => c.appendChild(creaPulsante(voce, dove)));
            }
            conteggi[dove].textContent = sezioni[dove].length;
        });

        // Sorteggio solo dove ha senso: in modalita' Sposta e con qualcosa da
        // sorteggiare.
        const sorteggiabile = modo === 'move' && sezioni.toUse.length > 0;
        tastoRandom.classList.toggle('hidden', !sorteggiabile);

        const rimettibile = modo === 'move' && sezioni.toUse.length === 0 && sezioni.used.length > 0;
        tastoRefill.classList.toggle('hidden', !rimettibile);

        // Cambiato il contenuto, la taglia giusta puo' essere un'altra.
        requestAnimationFrame(adattaAllaSchermata);
    }

    function tocca(voce, dove) {
        if (modo === 'move') {
            const prossima = { toUse: 'using', using: 'used', used: 'toUse' }[dove];
            sposta(voce, dove, prossima);
        } else if (modo === 'delete') {
            if (confirm('Eliminare «' + voce.name + '»?')) {
                sezioni[dove] = sezioni[dove].filter(v => v !== voce);
                salva();
                disegna();
            }
        }
        // In modalita' Nuovo i pulsanti non fanno niente: si sta scrivendo.
    }

    function sposta(voce, da, a) {
        const i = sezioni[da].indexOf(voce);
        if (i < 0) return;
        sezioni[da].splice(i, 1);
        sezioni[a].push(voce);
        salva();
        disegna();
    }

    // --- scelta dei colori ------------------------------------------------

    function creaTastiColore() {
        COLORI.forEach(colore => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'color-pulsante';
            b.dataset.color = colore;
            b.style.backgroundColor = colore;
            b.title = ETICHETTE[colore];

            const ordine = document.createElement('span');
            ordine.className = 'ordine hidden';
            b.appendChild(ordine);

            b.addEventListener('click', () => {
                const i = coloriScelti.indexOf(colore);
                if (i >= 0) coloriScelti.splice(i, 1);
                else coloriScelti.push(colore);
                aggiornaColori();
            });
            contenitoreColori.appendChild(b);
        });
    }

    function aggiornaColori() {
        contenitoreColori.querySelectorAll('.color-pulsante').forEach(b => {
            const posto = coloriScelti.indexOf(b.dataset.color);
            b.classList.toggle('selected', posto >= 0);
            const ordine = b.querySelector('.ordine');
            ordine.classList.toggle('hidden', posto < 0);
            ordine.textContent = posto + 1;
        });

        anteprima.innerHTML = '';
        const strisce = document.createElement('div');
        strisce.className = 'stripes';
        (coloriScelti.length ? coloriScelti : ['gray']).forEach(c => {
            const s = document.createElement('div');
            s.className = 'stripe';
            s.style.backgroundColor = c;
            strisce.appendChild(s);
        });
        const testo = document.createElement('span');
        testo.className = 'button-text';
        testo.textContent = maiuscoleIniziali(campoNome.value.trim()) || 'Nome';
        anteprima.appendChild(strisce);
        anteprima.appendChild(testo);
    }

    function apriScelta() {
        coloriScelti = [];
        aggiornaColori();
        sezioneColori.classList.remove('hidden');
        sezioneColori.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function chiudiScelta() {
        sezioneColori.classList.add('hidden');
        coloriScelti = [];
        aggiornaColori();
    }

    // --- modi -------------------------------------------------------------

    function impostaModo(nuovo) {
        modo = nuovo;
        Object.keys(modi).forEach(k => modi[k].classList.toggle('active', k === nuovo));
        campoNome.classList.toggle('hidden', nuovo !== 'add');
        if (nuovo !== 'add') chiudiScelta();
        else if (campoNome.value.trim()) apriScelta();
        disegna();
    }

    // --- eventi -----------------------------------------------------------

    campoNome.addEventListener('input', () => {
        if (campoNome.value.trim()) {
            sezioneColori.classList.remove('hidden');
            aggiornaColori();
        } else {
            sezioneColori.classList.add('hidden');
        }
    });

    tastoEnter.addEventListener('click', () => {
        const nome = maiuscoleIniziali(campoNome.value.trim());
        if (!nome) return;
        sezioni.toUse.push({
            name: nome,
            colors: coloriScelti.length ? coloriScelti.slice() : ['gray']
        });
        salva();
        campoNome.value = '';
        chiudiScelta();
        disegna();
    });

    tastoAnnulla.addEventListener('click', () => {
        campoNome.value = '';
        chiudiScelta();
    });

    tastoRandom.addEventListener('click', () => {
        if (!sezioni.toUse.length) return;
        const i = Math.floor(Math.random() * sezioni.toUse.length);
        sposta(sezioni.toUse[i], 'toUse', 'using');
    });

    tastoRefill.addEventListener('click', () => {
        sezioni.toUse = sezioni.toUse.concat(sezioni.used);
        sezioni.used = [];
        salva();
        disegna();
    });

    Object.keys(modi).forEach(k => {
        modi[k].addEventListener('click', () => impostaModo(k));
    });

    menuButton.addEventListener('click', () => menuPanel.classList.toggle('hidden'));
    menuChiudi.addEventListener('click', () => menuPanel.classList.add('hidden'));

    creaTastiColore();
    impostaModo('move');
    aggiornaColori();
    pianificaAdatta();

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(pianificaAdatta);
    }
    window.addEventListener('resize', () => {
        clearTimeout(window.__timerAdatta);
        window.__timerAdatta = setTimeout(adattaAllaSchermata, 150);
    });
});
