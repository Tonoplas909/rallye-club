// Écrans du mode carrière : calendrier, rallye en cours, championnat, résultats d'étape.
import { CARS, SURFACES } from './data.js';
import { save } from './save.js';
import {
  CALENDAR, DIFFICULTIES, PLAYER, STAGES_PER_RALLY, newCareer, startRally, rallyStages,
  recordStage, abandonTime, stageRanking, generalClassification, championship, driverName, driverFlag,
} from './career.js';
import { formatTime, formatDelta } from './util.js';

const $ = (id) => document.getElementById(id);
const ord = (n) => (n === 1 ? '1er' : `${n}e`);

export class CareerUI {
  constructor(app) {
    this.app = app;
    this.tab = 'rally';
    this.difficulty = 'normal';
    $('btn-career-continue').onclick = () => this.closeResult();
  }

  get career() { return save.data.career; }

  playerName() { return this.app.online?.profile?.pseudo || 'Toi'; }

  rallyCar() {
    const id = this.career?.rally?.car;
    return CARS.find((c) => c.id === id) || save.selectedCar;
  }

  // ------------------------------------------------------------- écran principal
  render() {
    const c = this.career;
    const el = $('screen-career');
    const cur = c && !c.finished ? CALENDAR[c.rallyIndex] : null;
    const head = c
      ? `<div class="career-head"><span>Saison <b>${c.season}</b> · ${DIFFICULTIES[c.difficulty].name}</span><a data-act="reset">Recommencer la carrière</a></div>`
      : '';
    el.innerHTML = `
      <div class="career">
        ${head}
        ${c ? `<div class="career-cols">
          <section class="calendar">${this.calendarHtml()}</section>
          <section class="career-panel">
            <div class="career-tabs">
              <button data-tab="rally" class="${this.tab === 'rally' ? 'active' : ''}">${c.finished ? 'Bilan' : 'Rallye'}</button>
              <button data-tab="champ" class="${this.tab === 'champ' ? 'active' : ''}">Championnat</button>
            </div>
            <div class="career-body">${this.tab === 'champ' ? this.championshipHtml() : c.finished ? this.seasonHtml() : this.rallyHtml(cur)}</div>
          </section>
        </div>` : this.welcomeHtml()}
        <div class="career-actions">${this.actionHtml()}</div>
      </div>`;
    el.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { this.tab = b.dataset.tab; this.render(); }; });
    el.querySelectorAll('[data-diff]').forEach((b) => { b.onclick = () => { this.difficulty = b.dataset.diff; this.render(); }; });
    el.querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => this.act(b.dataset.act); });
  }

  welcomeHtml() {
    const diffs = Object.entries(DIFFICULTIES).map(([id, d]) => `<button class="btn ${this.difficulty === id ? 'primary' : ''}" data-diff="${id}">${d.name}</button>`).join('');
    return `
      <div class="career-welcome">
        <h2>Championnat Rallye Club</h2>
        <p>6 rallyes de 3 spéciales face à 9 pilotes. Les temps s'additionnent au classement général. Les 10 premiers marquent des points (25, 18, 15…), et la dernière spéciale de chaque rallye, la Power Stage, rapporte 3, 2 et 1 points bonus.</p>
        <p>Pas de seconde chance : une spéciale ne se recourt pas. En cas d'abandon, tu reçois le temps du plus lent plus une minute.</p>
        <h4>Difficulté</h4>
        <div class="diff-row">${diffs}</div>
      </div>`;
  }

  calendarHtml() {
    const c = this.career;
    return CALENDAR.map((cal, i) => {
      const res = c.results[i];
      const status = res ? `<span class="pos">${ord(res.position)}</span> <small>+${res.points} pts</small>`
        : i === c.rallyIndex && !c.finished ? (c.rally ? `<span class="live">ES${c.rally.stage + 1}/${STAGES_PER_RALLY}</span>` : '<span class="live">Prochain</span>')
          : '<small>À venir</small>';
      const base = rallyStages(cal.id, c.season)[0];
      return `<div class="cal ${i === c.rallyIndex && !c.finished ? 'current' : ''} ${res ? 'done' : ''}">
        <span class="flag">${base.country}</span><div><b>${cal.name}</b><small>${SURFACES[base.surface].name}${base.night ? ' · nuit' : ''}</small></div><div class="st">${status}</div></div>`;
    }).join('');
  }

  rallyHtml(cal) {
    const c = this.career;
    const stages = rallyStages(cal.id, c.season);
    const r = c.rally;
    const list = stages.map((s, k) => {
      const t = r?.times[PLAYER][k];
      const rank = t != null ? stageRanking(r, k).find((x) => x.id === PLAYER).pos : null;
      return `<li class="${r && k === r.stage ? 'next' : ''}"><span>${s.name}${s.powerStage ? ' <em>Power Stage</em>' : ''}</span><span>${(s.length / 1000).toFixed(1)} km</span><span>${t != null ? `${formatTime(t)} · ${ord(rank)}` : ''}</span></li>`;
    }).join('');
    const gc = r && r.stage > 0 ? `<h4>Classement général après ES${r.stage}</h4>${this.table(generalClassification(r, r.stage - 1), 'gap')}` : '<p class="hint">Le classement général apparaîtra après la première spéciale.</p>';
    return `
      <h3>${stages[0].country} ${cal.name}</h3>
      <div class="hint">Voiture : <b>${this.rallyCar().name}</b>${r ? ' (fixée jusqu’à la fin du rallye)' : ' · change-la au garage avant le départ'}</div>
      <ol class="stage-list-mini">${list}</ol>
      ${gc}`;
  }

  championshipHtml() {
    const rows = championship(this.career).map((r) => ({ ...r, value: `${r.points} pts` }));
    return `<h4>Championnat pilotes</h4>${this.table(rows, 'value', 20)}`;
  }

  seasonHtml() {
    const c = this.career;
    const last = c.history.at(-1);
    return `<div class="season-end">
      <div class="trophy">${last.position === 1 ? '🏆' : last.position <= 3 ? '🥇🥈🥉'.slice((last.position - 1) * 2, last.position * 2) : '🏁'}</div>
      <h3>Saison ${c.season} terminée : ${ord(last.position)} au championnat</h3>
      <p class="hint">Champion : ${driverFlag(last.champion)} ${driverName(last.champion, this.playerName())}</p>
      ${c.history.length > 1 ? `<h4>Palmarès</h4><ul class="palmares">${c.history.map((h) => `<li>Saison ${h.season} (${DIFFICULTIES[h.difficulty]?.name ?? ''}) : ${ord(h.position)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  // Tableau de classement : top N + le joueur s'il n'y est pas.
  table(rows, col, top = 5) {
    const name = this.playerName();
    const line = (r) => `<tr class="${r.id === PLAYER ? 'me' : ''}"><td>${r.pos}</td><td>${driverFlag(r.id)} ${driverName(r.id, name)}</td><td>${col === 'gap' ? (r.pos === 1 ? formatTime(r.time) : formatDelta(r.gap)) : r[col]}</td></tr>`;
    const shown = rows.slice(0, top);
    const me = rows.find((r) => r.id === PLAYER);
    const extra = me && me.pos > top ? `<tr class="gap"><td colspan="3">…</td></tr>${line(me)}` : '';
    return `<table class="board"><tbody>${shown.map(line).join('')}${extra}</tbody></table>`;
  }

  actionHtml() {
    const c = this.career;
    if (!c) return '<button class="btn big primary" data-act="new">Commencer la saison 1</button>';
    if (c.finished) return `<button class="btn big primary" data-act="next-season">Saison ${c.season + 1}</button>`;
    const cal = CALENDAR[c.rallyIndex];
    const k = c.rally ? c.rally.stage : 0;
    const st = rallyStages(cal.id, c.season)[k];
    const label = c.rally ? `Départ ${st.name}` : `Commencer le ${cal.name}`;
    return `<button class="btn big primary" data-act="go">${label}<small>${this.rallyCar().name}</small></button>`;
  }

  act(name) {
    if (name === 'new') {
      save.data.career = newCareer(this.difficulty);
      save.persist();
      this.tab = 'rally';
      this.render();
    } else if (name === 'next-season') {
      const c = this.career;
      save.data.career = newCareer(c.difficulty, c.season + 1, c.history);
      save.persist();
      this.tab = 'rally';
      this.render();
    } else if (name === 'reset') {
      if (!confirm('Recommencer la carrière depuis la saison 1 ? Le palmarès sera effacé.')) return;
      save.data.career = null;
      save.persist();
      this.render();
    } else if (name === 'go') {
      this.startStage();
    }
  }

  startStage() {
    const c = this.career;
    if (!c.rally) {
      startRally(c);
      c.rally.car = save.selectedCar.id;
      save.persist();
    }
    const st = rallyStages(c.rally.id, c.season)[c.rally.stage];
    this.app.startRace(st, { career: true, car: this.rallyCar() });
  }

  // ------------------------------------------------------------- fin d'une spéciale
  onStageFinished(r) {
    const c = this.career;
    const stage = r.stage;
    const summary = recordStage(c, r.time);
    this.showResult(stage, r.time, summary, r.penalty);
  }

  abandon() {
    const c = this.career;
    const stage = rallyStages(c.rally.id, c.season)[c.rally.stage];
    const t = abandonTime(c.rally);
    const summary = recordStage(c, t);
    this.showResult(stage, t, summary, 0, true);
  }

  showResult(stage, time, s, penalty, abandoned = false) {
    const coins = [];
    if (!abandoned) coins.push(['Arrivée', stage.reward]);
    const me = s.stage.find((x) => x.id === PLAYER);
    if (!abandoned && me.pos === 1) coins.push(['Scratch (meilleur temps)', 200]);
    let banner = '';
    if (s.rally) {
      const R = s.rally;
      coins.push([`Rallye terminé : ${ord(R.position)}`, R.coins]);
      const ps = R.power.findIndex((x) => x.id === PLAYER);
      banner += `<div class="career-banner">🏁 ${stage.rallyName} : <b>${ord(R.position)}</b> · +${R.points} pts${ps >= 0 && ps < 3 ? ` (dont ${3 - ps} Power Stage)` : ''}</div>`;
      if (R.season) {
        coins.push([`Saison terminée : ${ord(R.season.position)}`, R.season.coins]);
        banner += `<div class="career-banner big">${R.season.champion ? '🏆 CHAMPION !' : `Saison terminée : ${ord(R.season.position)} au championnat`}</div>`;
      }
    }
    const total = coins.reduce((a, [, v]) => a + v, 0);
    save.addCoins(total); // enregistre aussi la carrière (même objet de sauvegarde)
    this.app.updateCoins(true);

    $('cres-title').textContent = `${stage.country} ${stage.rallyName} · ${stage.name}`;
    $('cres-time').textContent = abandoned ? 'Abandon' : formatTime(time);
    $('cres-sub').innerHTML = abandoned ? `Temps forfaitaire : ${formatTime(time)}`
      : `${ord(me.pos)} de la spéciale${me.pos > 1 ? ` · ${formatDelta(me.gap)}` : ' · meilleur temps !'}${penalty ? ` · dont ${penalty / 1000} s de pénalités` : ''}`;
    $('cres-tables').innerHTML = `
      <div><h4>Spéciale</h4>${this.table(s.stage, 'gap')}</div>
      <div><h4>Général</h4>${this.table(s.gc, 'gap')}</div>`;
    $('cres-banner').innerHTML = banner;
    $('cres-rewards').innerHTML = coins.map(([k, v]) => `<div class="r"><span>${k}</span><span>+${v} 🪙</span></div>`).join('')
      + (coins.length > 1 ? `<div class="r total"><span>Total</span><span>+${total} 🪙</span></div>` : '');
    $('screen-career-result').classList.remove('hidden');
    this.app.audio.coin();
    this.tab = s.rally?.season ? 'rally' : this.tab;
  }

  closeResult() {
    $('screen-career-result').classList.add('hidden');
    this.app.exitRace('career');
  }
}
