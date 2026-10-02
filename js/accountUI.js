// Interface des comptes en ligne : connexion, inscription, profil, classements.
import { CARS } from './data.js';
import { formatTime } from './util.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { idle: '', syncing: '⟳ Synchronisation…', synced: '✔ Progression sauvegardée en ligne', error: '⚠ Échec de la synchronisation' };

export class AccountUI {
  constructor(app, online) {
    this.app = app;
    this.online = online;
    this.view = 'login';
    // Le bouton n'apparaît qu'une fois la connexion au serveur vérifiée.
    $('btn-account').classList.add('hidden');
    $('btn-account').onclick = () => this.open();
    $('btn-account-close').onclick = () => this.close();
    $('btn-board-close').onclick = () => $('screen-board').classList.add('hidden');
    online.onChange(() => this.refresh());
    online.onPulled = () => {
      app.updateCoins(true);
      app.refreshScreen();
      if (app.screen === 'menu') app.showScreen('menu');
    };
    online.ready.then(() => {
      $('btn-account').classList.toggle('hidden', !online.configured);
      this.refresh();
    });
  }

  open() {
    if (!this.online.configured) return;
    this.view = this.online.loggedIn ? 'profile' : 'login';
    this.render();
    $('screen-account').classList.remove('hidden');
  }

  close() { $('screen-account').classList.add('hidden'); }

  refresh() {
    const o = this.online;
    const btn = $('btn-account');
    btn.innerHTML = o.loggedIn ? `<span class="acc-ico">👤</span><span class="acc-name">${esc(o.profile?.pseudo || '…')}</span>` : '<span class="acc-ico">👤</span><span class="acc-name">Connexion</span>';
    btn.classList.toggle('synced', o.status === 'synced');
    btn.classList.toggle('error', o.status === 'error');
    if (o.recovery) { this.view = 'recovery'; this.render(); $('screen-account').classList.remove('hidden'); return; }
    if (!$('screen-account').classList.contains('hidden')) {
      // Ne redessine pas un formulaire en cours (garderait sinon ni saisie ni message d'erreur).
      let view = this.view;
      if (o.loggedIn && view !== 'profile') view = 'profile';
      if (!o.loggedIn && view === 'profile') view = 'login';
      if (view !== this.view || view === 'profile') {
        const msg = $('acc-msg');
        const keep = msg && view === this.view ? [msg.textContent, msg.className] : null;
        this.view = view;
        this.render();
        if (keep) { $('acc-msg').textContent = keep[0]; $('acc-msg').className = keep[1]; }
      }
    }
  }

  // ------------------------------------------------------------- vues
  render() {
    const box = $('account-body');
    const o = this.online;
    const views = {
      login: () => `
        <p class="hint">Connecte-toi pour sauvegarder ta progression en ligne, la retrouver sur tous tes appareils et apparaître dans les classements.</p>
        <form data-form="login">
          <input name="email" type="email" placeholder="E-mail" autocomplete="email" required>
          <input name="password" type="password" placeholder="Mot de passe" autocomplete="current-password" required minlength="6">
          <button class="btn big primary" type="submit">Se connecter</button>
        </form>
        <div class="acc-links"><a data-go="signup">Créer un compte</a><a data-go="forgot">Mot de passe oublié ?</a></div>`,
      signup: () => `
        <p class="hint">Ta progression actuelle sera conservée et envoyée sur ton nouveau compte.</p>
        <form data-form="signup">
          <input name="pseudo" placeholder="Pseudo (3 à 20 caractères)" required minlength="3" maxlength="20" autocomplete="nickname">
          <input name="email" type="email" placeholder="E-mail" autocomplete="email" required>
          <input name="password" type="password" placeholder="Mot de passe (6 caractères min.)" autocomplete="new-password" required minlength="6">
          <button class="btn big primary" type="submit">Créer mon compte</button>
        </form>
        <div class="acc-links"><a data-go="login">J’ai déjà un compte</a></div>`,
      forgot: () => `
        <p class="hint">Indique ton e-mail : tu recevras un lien pour choisir un nouveau mot de passe.</p>
        <form data-form="forgot">
          <input name="email" type="email" placeholder="E-mail" autocomplete="email" required>
          <button class="btn big primary" type="submit">Envoyer le lien</button>
        </form>
        <div class="acc-links"><a data-go="login">Retour</a></div>`,
      recovery: () => `
        <p class="hint">Choisis ton nouveau mot de passe.</p>
        <form data-form="recovery">
          <input name="password" type="password" placeholder="Nouveau mot de passe" autocomplete="new-password" required minlength="6">
          <button class="btn big primary" type="submit">Enregistrer</button>
        </form>`,
      profile: () => `
        <div class="acc-profile">
          <div class="acc-avatar">👤</div>
          <div><div class="acc-pseudo">${esc(o.profile?.pseudo || '…')}</div><div class="hint">${esc(o.user?.email || '')}</div></div>
        </div>
        <form data-form="pseudo" class="acc-inline">
          <input name="pseudo" placeholder="Nouveau pseudo" minlength="3" maxlength="20" required>
          <button class="btn" type="submit">Renommer</button>
        </form>
        <div class="acc-status ${o.status}">${STATUS[o.status] || ''}${o.lastSync ? ` · ${o.lastSync.toLocaleTimeString('fr-FR')}` : ''}</div>
        <button class="btn" data-action="sync">Synchroniser maintenant</button>
        <button class="btn danger" data-action="logout">Se déconnecter</button>`,
    };
    const titles = { login: 'CONNEXION', signup: 'CRÉER UN COMPTE', forgot: 'MOT DE PASSE OUBLIÉ', recovery: 'NOUVEAU MOT DE PASSE', profile: 'MON COMPTE' };
    $('account-title').textContent = titles[this.view];
    box.innerHTML = views[this.view]() + '<div class="acc-msg" id="acc-msg"></div>';
    box.querySelectorAll('[data-go]').forEach((a) => { a.onclick = () => { this.view = a.dataset.go; this.render(); }; });
    box.querySelectorAll('form').forEach((f) => { f.onsubmit = (e) => { e.preventDefault(); this.submit(f); }; });
    box.querySelectorAll('[data-action]').forEach((b) => { b.onclick = () => this.action(b.dataset.action); });
    // Les touches tapées dans les champs ne doivent pas piloter la voiture du menu.
    box.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
  }

  message(text, bad = false) {
    const m = $('acc-msg');
    if (!m) return;
    m.textContent = text;
    m.className = `acc-msg ${bad ? 'bad' : 'good'}`;
  }

  async submit(form) {
    const f = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      if (form.dataset.form === 'login') {
        await this.online.signIn(f.email.trim(), f.password);
        this.app.toast('Connecté !');
      } else if (form.dataset.form === 'signup') {
        const { needsConfirmation } = await this.online.signUp(f.email.trim(), f.password, f.pseudo.trim());
        if (needsConfirmation) {
          this.view = 'login';
          this.render();
          this.message('Compte créé ! Clique sur le lien reçu par e-mail, puis connecte-toi.');
          return;
        }
        this.app.toast('Compte créé, bienvenue !');
      } else if (form.dataset.form === 'forgot') {
        await this.online.resetPassword(f.email.trim());
        this.message('Si un compte existe pour cet e-mail, un lien vient d’être envoyé.');
      } else if (form.dataset.form === 'recovery') {
        await this.online.updatePassword(f.password);
        this.view = 'profile';
        this.render();
        this.message('Mot de passe mis à jour.');
      } else if (form.dataset.form === 'pseudo') {
        await this.online.updatePseudo(f.pseudo.trim());
        this.message('Pseudo modifié.');
      }
    } catch (e) {
      this.message(e.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  async action(name) {
    if (name === 'logout') {
      await this.online.signOut();
      this.app.toast('Déconnecté. Ta progression reste sur cet appareil.');
      this.view = 'login';
      this.render();
    } else if (name === 'sync') {
      await this.online.pull();
    }
  }

  // ------------------------------------------------------------- classements
  boardRows({ top, me }) {
    const uid = this.online.user?.id;
    const row = (r) => `<tr class="${r.user_id === uid ? 'me' : ''}"><td>${r.rang}</td><td>${esc(r.pseudo)}</td><td>${esc(CARS.find((c) => c.id === r.car_id)?.name || r.car_id)}</td><td>${formatTime(r.time_ms)}</td></tr>`;
    if (!top.length) return '<p class="hint">Aucun temps pour l’instant. Sois le premier !</p>';
    return `<table class="board"><thead><tr><th>#</th><th>Pilote</th><th>Voiture</th><th>Temps</th></tr></thead><tbody>
      ${top.map(row).join('')}${me ? `<tr class="gap"><td colspan="4">…</td></tr>${row(me)}` : ''}</tbody></table>`;
  }

  // Classement complet d'une spéciale (depuis la liste des spéciales).
  async openBoard(stage) {
    $('board-title').textContent = `🏆 ${stage.name}`;
    $('board-body').innerHTML = '<div class="spinner small"></div>';
    $('screen-board').classList.remove('hidden');
    try {
      $('board-body').innerHTML = this.boardRows(await this.online.leaderboard(stage.id, 20))
        + (this.online.loggedIn ? '' : '<p class="hint">Connecte-toi pour enregistrer tes temps dans le classement.</p>');
    } catch (e) {
      $('board-body').innerHTML = `<p class="hint bad">${esc(e.message)}</p>`;
    }
  }

  // Après une arrivée : envoi du temps puis affichage du classement dans l'écran de résultats.
  async afterRace(result) {
    const el = $('res-board');
    if (!this.online.configured) { el.innerHTML = ''; return; }
    if (result.cheated) { el.innerHTML = '<p class="hint">Mode debug : temps non envoyé au classement.</p>'; return; }
    el.innerHTML = '<div class="spinner small"></div>';
    try {
      let note = '';
      if (this.online.loggedIn) {
        const improved = await this.online.submitTime(result.key, result.car.id, result.time);
        note = improved ? '<p class="hint good">Nouveau meilleur temps en ligne !</p>' : '';
      } else {
        note = '<p class="hint"><a data-login>Connecte-toi</a> pour apparaître dans le classement.</p>';
      }
      el.innerHTML = `<h4>Classement mondial</h4>${note}${this.boardRows(await this.online.leaderboard(result.key, 5))}`;
      el.querySelector('[data-login]')?.addEventListener('click', () => this.open());
    } catch (e) {
      el.innerHTML = `<p class="hint bad">Classement indisponible : ${esc(e.message)}</p>`;
    }
  }
}

