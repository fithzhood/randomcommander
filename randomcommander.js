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

// Tutto su una schermata, senza scorrere, e con la scritta piu' grande che
// quella schermata consente.
//
// Le due cose si tirano: meno colonne vuol dire celle piu' larghe e quindi nome
// piu' grande, ma anche piu' righe, e le righe fanno crescere l'altezza. Non
// c'e' una taglia giusta a priori — dipende da quanti mazzi ci sono e da quanto
// il telefono ingrandisce il testo — quindi si provano le combinazioni e si
// tiene quella che fa il nome piu' grande stando dentro lo schermo.
const COLONNE_POSSIBILI = [3, 4];
const ALTEZZE = [72, 66, 60, 56, 52, 48, 44, 40, 36];
const CORPO_NOME_MAX = 1.25;   // rem
const CORPO_NOME_MIN = 0.62;   // sotto non si scende: si cambia piuttosto colonne

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

function applica(colonne, altezza, corpo) {
    const s = document.body.style;
    s.setProperty('--colonne', colonne);
    s.setProperty('--altezza-tasto', altezza + 'px');
    s.setProperty('--corpo-nome', corpo.toFixed(3) + 'rem');
    // Spazi e titoli seguono l'altezza: se i pulsanti sono piccoli, stringere
    // anche il resto e' quello che fa stare tutto.
    const stretto = altezza <= 48;
    s.setProperty('--spazio-griglia', (stretto ? 5 : 8) + 'px');
    s.setProperty('--spazio-sezione', (stretto ? 7 : 10) + 'px');
    s.setProperty('--corpo-sezione', (stretto ? 1 : 1.15) + 'rem');
}

// Il corpo piu' grande che fa entrare il nome piu' lungo nella cella, senza
// andare a capo e senza puntini. Zero se non ce n'e' nessuno.
function corpoCheEntra() {
    const tasto = document.querySelector('.griglia .name-button');
    const targa = tasto && tasto.querySelector('.button-text');
    if (!tasto || !targa) return CORPO_NOME_MAX;

    const nomi = Array.prototype.map.call(
        document.querySelectorAll('.griglia .button-text'), t => t.textContent);
    if (!nomi.length) return CORPO_NOME_MAX;

    const s = getComputedStyle(targa);
    const corpoOra = parseFloat(s.fontSize);
    // Il fianco della targhetta e' in em, quindi cresce col corpo: si misura in
    // proporzione, non in pixel fissi.
    const fianchi = (parseFloat(s.paddingLeft) + parseFloat(s.paddingRight)) / corpoOra;
    const disponibile = tasto.getBoundingClientRect().width - 8 - 6 - 2;
    if (disponibile <= 0) return 0;

    // Il metro misura SOLO il testo: i fianchi si aggiungono dopo, non si
    // tolgono qui. Sottraendoli veniva fuori un corpo troppo grande e i nomi
    // lunghi finivano coi puntini.
    let piuLargo = 0;
    document.querySelectorAll('.griglia .button-text').forEach(t => {
        piuLargo = Math.max(piuLargo, larghezzaNome(t.textContent, t));
    });
    if (piuLargo <= 0) return CORPO_NOME_MAX;

    // larghezza(corpo) = piuLargo * corpo / corpoOra + fianchi * corpo
    const perUnita = piuLargo / corpoOra + fianchi;
    const corpoPx = disponibile / perUnita;
    const rem = corpoPx / parseFloat(getComputedStyle(document.documentElement).fontSize);
    if (rem < CORPO_NOME_MIN) return 0;
    return Math.min(CORPO_NOME_MAX, rem);
}

function ciSta() {
    return document.documentElement.scrollHeight <= window.innerHeight + 1;
}

function adattaAllaSchermata() {
    let migliore = null;

    COLONNE_POSSIBILI.forEach(colonne => {
        for (let i = 0; i < ALTEZZE.length; i++) {
            applica(colonne, ALTEZZE[i], CORPO_NOME_MAX);
            const corpo = corpoCheEntra();
            if (!corpo) break;               // con queste colonne il nome non ci sta
            applica(colonne, ALTEZZE[i], corpo);
            if (ciSta()) {
                // Le altezze scendono, quindi questa e' la piu' alta che regge
                // per questo numero di colonne: piu' in giu' non serve guardare.
                if (!migliore || corpo > migliore.corpo + 0.01) {
                    migliore = { colonne: colonne, altezza: ALTEZZE[i], corpo: corpo };
                }
                break;
            }
        }
    });

    if (migliore) {
        applica(migliore.colonne, migliore.altezza, migliore.corpo);
    } else {
        // Non ci sta comunque: si prende il piu' stretto e si lascia scorrere,
        // che e' meglio di un nome tagliato.
        applica(4, ALTEZZE[ALTEZZE.length - 1], CORPO_NOME_MIN);
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
