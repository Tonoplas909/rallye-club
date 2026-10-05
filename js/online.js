// Comptes en ligne (Supabase) : connexion, sauvegarde cloud, classements.
// Sans configuration (js/config.js vide), tout reste hors ligne et ces méthodes ne font rien.
import { SUPABASE } from './config.js';
import { save } from './save.js';
import { mergeSaves, cloudPayload } from './merge.js';

const PUSH_DELAY = 2500;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Chargement impossible : ${src}`));
    document.head.appendChild(s);
  });
}

// Messages d'erreur Supabase les plus courants, en français.
function frError(err) {
  const m = (err?.message || String(err)).toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return 'Confirme d’abord ton adresse e-mail (lien reçu par mail).';
  if (m.includes('user already registered')) return 'Un compte existe déjà avec cet e-mail.';
  if (m.includes('password should be at least')) return 'Mot de passe trop court (6 caractères minimum).';
  if (m.includes('unable to validate email') || m.includes('invalid format')) return 'Adresse e-mail invalide.';
  if (m.includes('rate limit')) return 'Trop de tentatives, réessaie dans quelques minutes.';
  if (m.includes('duplicate key') && m.includes('pseudo')) return 'Ce pseudo est déjà pris.';
  if (m.includes('pseudo_check') || m.includes('check constraint')) return 'Le pseudo doit faire entre 3 et 20 caractères.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Pas de connexion au serveur.';
  return err?.message || 'Erreur inconnue.';
}

export class Online {
  constructor() {
    this.enabled = !!(SUPABASE.enabled && SUPABASE.url && SUPABASE.anonKey);
    this.client = null;
    this.user = null;
    this.profile = null;
    this.status = this.enabled ? 'idle' : 'disabled'; // idle | syncing | synced | error | disabled
    this.listeners = [];
    this.pushTimer = null;
    this.ready = this.enabled ? this.init() : Promise.resolve();
  }

  get configured() { return this.enabled; }
  get loggedIn() { return !!this.user; }

  onChange(fn) { this.listeners.push(fn); }
  emit() { for (const fn of this.listeners) fn(this); }
  setStatus(s) { this.status = s; this.emit(); }

  async init() {
    try {
      await loadScript(new URL('../vendor/supabase/supabase.js', import.meta.url).href);
      this.client = window.supabase.createClient(SUPABASE.url, SUPABASE.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    } catch (e) {
      console.warn('Comptes en ligne indisponibles :', e);
      this.enabled = false;
      this.setStatus('disabled');
      return;
    }
    // Si la migration SQL n'a pas encore été appliquée, on reste hors ligne sans erreur.
    const probe = await this.client.from('profiles').select('id').limit(1);
    if (probe.error) {
      console.warn('Comptes en ligne désactivés : schéma Supabase absent ou inaccessible.', probe.error.message);
      this.enabled = false;
      this.setStatus('disabled');
      return;
    }
    this.client.auth.onAuthStateChange((event, session) => {
      // Ne pas appeler Supabase directement dans ce rappel (verrou interne) : on diffère.
      setTimeout(() => this.handleAuth(event, session), 0);
    });
    const { data } = await this.client.auth.getSession();
    if (data.session) await this.handleAuth('INITIAL_SESSION', data.session);
    save.onChange(() => this.schedulePush());
    // Envoie la sauvegarde en attente quand l'onglet passe en arrière-plan.
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.flush(); });
  }

  async handleAuth(event, session) {
    const uid = session?.user?.id || null;
    if (event === 'PASSWORD_RECOVERY') this.recovery = true;
    if (uid === this.user?.id && event !== 'USER_UPDATED' && event !== 'PASSWORD_RECOVERY') return;
    this.user = session?.user || null;
    if (!this.user) {
      this.profile = null;
      this.setStatus('idle');
      return;
    }
    await this.loadProfile();
    await this.pull();
    this.emit();
  }

  async loadProfile() {
    const { data, error } = await this.client.from('profiles').select('pseudo, created_at').eq('id', this.user.id).maybeSingle();
    if (error) console.warn(error);
    this.profile = data || null;
  }

  // ------------------------------------------------------------- compte
  async signUp(email, password, pseudo) {
    const { data, error } = await this.client.auth.signUp({
      email, password,
      options: { data: { pseudo }, emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw new Error(frError(error));
    // Si la confirmation par e-mail est activée, il n'y a pas encore de session.
    return { needsConfirmation: !data.session };
  }

  async signIn(email, password) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(frError(error));
  }

  async signOut() {
    await this.flush();
    await this.client.auth.signOut();
    this.user = null;
    this.profile = null;
    this.setStatus('idle');
  }

  async resetPassword(email) {
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw new Error(frError(error));
  }

  async updatePassword(password) {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw new Error(frError(error));
    this.recovery = false;
    this.emit();
  }

  async updatePseudo(pseudo) {
    const { error } = await this.client.from('profiles').update({ pseudo }).eq('id', this.user.id);
    if (error) throw new Error(frError(error));
    await this.loadProfile();
    this.emit();
  }

  // ------------------------------------------------------------- sauvegarde cloud
  async pull() {
    this.setStatus('syncing');
    const { data, error } = await this.client.from('saves').select('data').eq('user_id', this.user.id).maybeSingle();
    if (error) { console.warn(error); this.setStatus('error'); return; }
    const merged = mergeSaves(save.data, data?.data || null);
    save.replace(merged);
    await this.push();
    this.onPulled?.();
  }

  schedulePush() {
    if (!this.user) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.push(), PUSH_DELAY);
  }

  async push() {
    if (!this.user) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = null;
    this.setStatus('syncing');
    const { error } = await this.client.from('saves').upsert({
      user_id: this.user.id, data: cloudPayload(save.data), updated_at: new Date().toISOString(),
    });
    if (error) { console.warn(error); this.setStatus('error'); return; }
    this.lastSync = new Date();
    this.setStatus('synced');
  }

  // Envoie immédiatement une sauvegarde en attente (avant déconnexion ou fermeture).
  async flush() { if (this.pushTimer) await this.push(); }

  // ------------------------------------------------------------- classements
  async submitTime(stageKey, carId, timeMs) {
    if (!this.user) return false;
    const { data, error } = await this.client.rpc('submit_time', { p_stage: stageKey, p_car: carId, p_time: Math.round(timeMs) });
    if (error) { console.warn(error); return false; }
    return data;
  }

  async leaderboard(stageKey, limit = 10) {
    if (!this.client) return { top: [], me: null };
    const { data: top, error } = await this.client.from('leaderboard')
      .select('rang, pseudo, user_id, car_id, time_ms').eq('stage_key', stageKey).order('time_ms').limit(limit);
    if (error) throw new Error(frError(error));
    let me = null;
    if (this.user && !top.some((r) => r.user_id === this.user.id)) {
      const res = await this.client.from('leaderboard')
        .select('rang, pseudo, user_id, car_id, time_ms').eq('stage_key', stageKey).eq('user_id', this.user.id).maybeSingle();
      me = res.data || null;
    }
    return { top, me };
  }
}
