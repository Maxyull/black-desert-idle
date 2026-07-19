// ============================================================
// PANNEAU "MON COMPTE" (identite + parrainage, comptes verifies)
// ============================================================
// Extrait de src/backend/game-supabase.js le 2026-07-22 (2e vague de decoupe, apres P5) : le
// fichier restait a 1751 lignes. Ce bloc etait deja borne (openAccountPanel + 2 helpers) et sans aucun cablage au chargement.
//
// Charge APRES game-supabase.js (il y lit sb/currentUser au runtime, jamais au chargement).
// Aucun wiring a deplacer : le bouton est cable par onclick="openAccountPanel()" dans
// index.dev.html, resolu au clic (runtime), pas ici.

// ---------- panneau "Mon compte" : identité + parrainage (comptes vérifiés uniquement) ----------
/** @param {string} iso - date ISO. @returns {string} date formatée dans la locale du jeu (backend.common.date_locale), '—' si absente/invalide. */
function acctFmtDate(iso) {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  return new Date(t).toLocaleDateString(i18next.t('backend:backend.common.date_locale'), { year:'numeric', month:'long', day:'numeric' });
}
/** Calcule le rang du joueur courant dans la catégorie Gearscore du classement public (réutilise lb2ComputeYourRankInfo, même fetch que openLeaderboard2()). @returns {?{rank:number,total:number}} null si non classé/erreur réseau. */
async function acctFetchGsRank() {
  try {
    const { data, error } = await sb.from('player_stats').select('*').limit(500);
    if (error || !data) return null;
    return lb2ComputeYourRankInfo(data, 'gs', currentUser.id);
  } catch(e) { return null; }
}
/** Ouvre le panneau "Mon compte" refonte en cartes (identité/palier, progression, rang, connexion+streak, pseudo, sécurité, comptes liés, parrainage, maintenance/suppression). Version simplifiée (cache navigateur uniquement) pour un invité. */
async function openAccountPanel() {
  if (!sb || !currentUser) return;
  if (isGuest()) {
    openInfo(i18next.t('backend:backend.account.panel_title'), `
      <p>${i18next.t('backend:backend.account.guest_intro')}</p>
      <h3>🧹 ${i18next.t('backend:backend.account.cache_title')}</h3>
      <p class="mHint">${i18next.t('backend:backend.account.cache_hint')}</p>
      <button id="btnClearCache">🧹 ${i18next.t('backend:backend.account.cache_clear_button')}</button>
    `);
    $a('btnClearCache').onclick = clearGameCache;
    return;
  }
  let code = '', count = 0, referrals = [];
  try { const { data } = await sb.rpc('ensure_referral_code'); code = data || ''; } catch(e) {}
  try { const { data } = await sb.rpc('get_referral_count'); count = data || 0; } catch(e) {}
  try { const { data } = await sb.rpc('get_my_referrals'); referrals = data || []; } catch(e) {}

  const refRows = referrals.map(r => `
    <tr><td>${escapeHtml(r.display_name||'?')}</td><td>${r.lvl}</td><td>${fmt(r.gearscore)}</td><td>${fmt(r.silver)}</td></tr>
  `).join('') || `<tr><td colspan="4" class="admEmpty">${i18next.t('backend:backend.account.no_referrals')}</td></tr>`;

  const rules = i18next.t('backend:backend.account.referral_rules', { returnObjects: true });

  const hasDiscord = !!discordIdentity(currentUser);
  const hasGoogle = !!providerIdentity(currentUser, 'google');
  const hasGithub = !!providerIdentity(currentUser, 'github');
  const hasTwitter = !!providerIdentity(currentUser, 'twitter');
  const hasEmailAuth = !!providerIdentity(currentUser, 'email'); // §6 du brief : bloc Sécurité (mot de passe) seulement pour un compte email+mdp, pas un compte 100% OAuth

  const tier = (typeof gearTierForZone === 'function') ? gearTierForZone(zoneIdx) : null;
  const tierLabel = tier ? (tier.label[LANG] || tier.label.fr) : '';

  const html = `
    <div class="acctIdentity">
      <div class="acctAvatar">👤</div>
      <div class="acctIdentityInfo">
        <div class="acctNameRow">
          <span class="acctName">${escapeHtml(myPseudo || '?')}</span>
          ${tier ? `<span class="acctTierBadge" style="--tierColor:${tier.color}">⬥ ${escapeHtml(tierLabel)}</span>` : ''}
        </div>
        <div class="acctEmail">${escapeHtml(currentUser.email || '—')}</div>
      </div>
    </div>

    <div class="acctCard">
      <h3>📈 ${i18next.t('backend:backend.account.progression_title')}</h3>
      <div class="acctGrid acctGrid4">
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.level_label')}</span><span class="acctStatVal">${S.lvl}</span></div>
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.gearscore_label')}</span><span class="acctStatVal">${Math.round(S.bestGearscore||0)}</span></div>
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.best_silver_hour_label')}</span><span class="acctStatVal">${fmt(S.bestSilverPerHour||0)}/h</span></div>
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.member_since_label')}</span><span class="acctStatVal acctStatValSm">${acctFmtDate(currentUser.created_at)}</span></div>
      </div>
      <div class="acctDivider"></div>
      <div class="acctRankRow" id="acctRankRow">🏆 ${i18next.t('backend:backend.account.rank_gs_label')} <span id="acctRankVal" class="acctRankVal">${i18next.t('backend:backend.account.rank_loading')}</span></div>
    </div>

    <!-- Préférences (2026-07-19) : compteurs en ligne + langue préférée + Confiance & Sécurité,
         rapatriés ici depuis l'ancienne sidebar gauche (menus déplacés dans le header). Libellés en
         ligne (LANG) plutôt que nouvelles clés i18n, comme btnTrust (wiki-codex.js). -->
    <div class="acctCard">
      <h3>⚙️ ${LANG !== 'en' ? 'Préférences' : 'Preferences'}</h3>
      <div class="acctGrid acctGrid3">
        <div class="acctStat"><span class="acctStatLabel">${LANG !== 'en' ? 'Joueurs en ligne' : 'Players online'}</span><span class="acctStatVal">🟢 ${(document.getElementById('onlineTotal') || {}).textContent || '—'}</span></div>
        <div class="acctStat"><span class="acctStatLabel">${LANG !== 'en' ? 'Inscrits' : 'Registered'}</span><span class="acctStatVal">👤 ${(document.getElementById('registeredTotal') || {}).textContent || '—'}</span></div>
        <div class="acctStat"><span class="acctStatLabel">${LANG !== 'en' ? 'Langue préférée' : 'Preferred language'}</span><span class="acctStatVal" style="display:flex;gap:5px;justify-content:center"><button id="acctLangFr" class="acctLangBtn">🇫🇷 FR</button><button id="acctLangEn" class="acctLangBtn">🇬🇧 EN</button></span></div>
      </div>
      <div class="acctDivider"></div>
      <button id="btnAcctTrust">🛡️ ${LANG !== 'en' ? 'Confiance & Sécurité' : 'Trust & Security'}</button>
    </div>

    <div class="acctCard">
      <h3>🔌 ${i18next.t('backend:backend.account.connection_title')}</h3>
      <div class="acctGrid acctGrid3">
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.last_login_label')}</span><span class="acctStatVal acctStatValSm">${acctFmtDate(currentUser.last_sign_in_at)}</span></div>
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.playtime_total_label')}</span><span class="acctStatVal">${fmtHours(S.playtimeSec||0)}</span></div>
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.streak_label')}</span><span class="acctStatVal">🔥 ${i18next.t('backend:backend.account.streak_days', { count: S.loginStreak||0 })}</span></div>
      </div>
    </div>

    <div class="acctCard">
      <h3>${i18next.t('backend:backend.account.nickname_title')}</h3>
      <p class="mHint">${i18next.t('backend:backend.account.nickname_hint')}</p>
      <input type="text" id="pseudoInput" value="${myPseudo || ''}" maxlength="20">
      <button id="btnSavePseudo">${i18next.t('backend:backend.account.save_button')}</button>
      <div id="pseudoMsg"></div>
    </div>

    ${hasEmailAuth ? `
    <div class="acctCard">
      <h3>🔒 ${i18next.t('backend:backend.account.security_title')}</h3>
      <p class="mHint">${i18next.t('backend:backend.account.change_password_hint')}</p>
      <button id="btnChangePassword">🔒 ${i18next.t('backend:backend.account.change_password_button')}</button>
      <div id="changePasswordMsg"></div>
    </div>` : ''}

    <div class="acctCard">
      <h3>${i18next.t('backend:backend.account.linked_accounts_title')}</h3>
      <div class="acctGrid acctGrid2">
        <div class="acctLinkRow">
          <span>💬 Discord</span>
          ${hasDiscord
            ? `<span class="mHint">${i18next.t('backend:backend.account.discord_connected')}</span>`
            : `<button id="btnLinkDiscord" class="discordBtn">🎮 ${i18next.t('backend:backend.account.discord_connect_button')}</button>`}
        </div>
        <div class="acctLinkRow">
          <span>🔵 Google</span>
          ${hasGoogle
            ? `<span class="mHint">${i18next.t('backend:backend.account.google_connected')}</span>`
            : `<button id="btnLinkGoogle" class="googleBtn">🔵 ${i18next.t('backend:backend.account.google_connect_button')}</button>`}
        </div>
        <div class="acctLinkRow">
          <span>🐙 GitHub</span>
          ${hasGithub
            ? `<span class="mHint">${i18next.t('backend:backend.account.github_connected')}</span>`
            : `<button id="btnLinkGithub" class="githubBtn">🐙 ${i18next.t('backend:backend.account.github_connect_button')}</button>`}
        </div>
        <div class="acctLinkRow">
          <span>🐦 Twitter/X</span>
          ${hasTwitter
            ? `<span class="mHint">${i18next.t('backend:backend.account.twitter_connected')}</span>`
            : `<button id="btnLinkTwitter" class="twitterBtn">🐦 ${i18next.t('backend:backend.account.twitter_connect_button')}</button>`}
        </div>
      </div>
    </div>

    <div class="acctCard">
      <h3>${i18next.t('backend:backend.account.referrals_title')}</h3>
      <div id="refCodeBox">${code}</div>
      <button id="btnCopyRefCode">${i18next.t('backend:backend.account.copy_code_button')}</button>
      <div class="admSummary" style="margin-top:14px">${i18next.t('backend:backend.account.has_code_prompt')}</div>
      <input type="text" id="refCodeInput" placeholder="${i18next.t('backend:backend.account.referral_code_placeholder')}" maxlength="12">
      <button id="btnApplyRefCode">${i18next.t('backend:backend.account.apply_button')}</button>
      <div id="refMsg"></div>
      <ul class="refRules">${rules.map(r => `<li>${r}</li>`).join('')}</ul>

      <h3>${i18next.t('backend:backend.account.your_referrals_title')} (<span style="color:var(--gold)">${count}</span>)</h3>
      <table class="admTable">
        <thead><tr><th>${i18next.t('backend:backend.common.player_label')}</th><th>${i18next.t('backend:backend.account.level_label')}</th><th>GS</th><th>Silver</th></tr></thead>
        <tbody>${refRows}</tbody>
      </table>
    </div>

    <div class="acctCard">
      <h3>🧹 ${i18next.t('backend:backend.account.maintenance_title')}</h3>
      <p class="mHint">${i18next.t('backend:backend.account.cache_hint')}</p>
      <button id="btnClearCache">🧹 ${i18next.t('backend:backend.account.cache_clear_button')}</button>
      <div class="acctDivider"></div>
      <button id="btnDeleteAccount" class="acctDangerBtn">🗑️ ${i18next.t('backend:backend.account.delete_account_button')}</button>
      <div id="acctDeleteConfirmBox" class="acctDangerBox" style="display:none">
        <p class="acctDangerWarning">⚠️ ${i18next.t('backend:backend.account.delete_account_warning')}</p>
        <p class="mHint">${i18next.t('backend:backend.account.delete_account_confirm_prompt', { pseudo: escapeHtml(myPseudo || '') })}</p>
        <input type="text" id="acctDeleteConfirmInput" placeholder="${escapeHtml(i18next.t('backend:backend.account.delete_account_confirm_placeholder'))}">
        <div class="acctDangerBtnRow">
          <button id="btnDeleteAccountCancel">${i18next.t('backend:backend.account.delete_account_cancel_button')}</button>
          <button id="btnDeleteAccountConfirm" class="acctDangerBtn" disabled>${i18next.t('backend:backend.account.delete_account_confirm_button')}</button>
        </div>
        <div id="acctDeleteMsg"></div>
      </div>
    </div>
  `;
  openInfo(i18next.t('backend:backend.account.panel_title'), html);
  $a('btnClearCache').onclick = clearGameCache;
  // Confiance & Sécurité depuis le panneau compte (2026-07-19) : ouvre le MÊME contenu que l'ancien
  // bouton sidebar btnTrust (renderTrustSecurityHtml, wiki-codex.js).
  if ($a('btnAcctTrust')) $a('btnAcctTrust').onclick = () => openInfo(LANG !== 'en' ? '🛡️ Confiance & Sécurité' : '🛡️ Trust & Security', renderTrustSecurityHtml());
  // langue préférée : réutilise les handlers déjà câblés du toggle de langue du header (#langToggle)
  if ($a('acctLangFr')) $a('acctLangFr').onclick = () => { const el = document.querySelector('#langToggle .langOpt[data-lang="fr"]'); if (el) el.click(); };
  if ($a('acctLangEn')) $a('acctLangEn').onclick = () => { const el = document.querySelector('#langToggle .langOpt[data-lang="en"]'); if (el) el.click(); };
  $a('btnSavePseudo').onclick = async () => {
    const val = $a('pseudoInput').value.trim();
    const msg = $a('pseudoMsg');
    const { error } = await sb.rpc('set_pseudo', { p_pseudo: val });
    if (error) { msg.textContent = error.message; msg.className = 'fail'; return; }
    myPseudo = val;
    updatePseudoDisplay();
    msg.textContent = i18next.t('backend:backend.account.nickname_saved'); msg.className = 'ok';
    syncPlayerStats(); // propage immédiatement au classement, sans attendre la prochaine synchro
  };
  if (!hasDiscord) $a('btnLinkDiscord').onclick = linkDiscordAccount;
  if (!hasGoogle) $a('btnLinkGoogle').onclick = linkGoogleAccount;
  if (!hasGithub) $a('btnLinkGithub').onclick = linkGithubAccount;
  if (!hasTwitter) $a('btnLinkTwitter').onclick = linkTwitterAccount;
  $a('btnCopyRefCode').onclick = async () => {
    try { await navigator.clipboard.writeText(code); } catch(e) {}
    $a('btnCopyRefCode').textContent = i18next.t('backend:backend.account.code_copied');
  };
  $a('btnApplyRefCode').onclick = async () => {
    const val = $a('refCodeInput').value.trim();
    const msg = $a('refMsg');
    if (!val) { msg.textContent = i18next.t('backend:backend.account.enter_code_prompt'); msg.className = 'fail'; return; }
    const { error } = await sb.rpc('apply_referral_code', { p_code: val });
    if (error) { msg.textContent = error.message; msg.className = 'fail'; return; }
    msg.textContent = i18next.t('backend:backend.account.code_applied'); msg.className = 'ok';
  };

  // rang Gearscore (2026-07-13, carte Progression) — requête réseau supplémentaire, chargée après
  // coup pour ne jamais bloquer l'ouverture du panneau ; échec réseau/pas encore de ligne
  // player_stats -> affiche '—' sans planter (même tolérance que le reste de ce panneau).
  $a('acctRankRow').onclick = () => { lb2Cat = 'gs'; openLeaderboard2(); };
  acctFetchGsRank().then(info => {
    const el = $a('acctRankVal');
    if (!el) return; // panneau refermé entre-temps
    el.textContent = info ? i18next.t('backend:backend.account.rank_of', { rank: info.rank, total: info.total }) : i18next.t('backend:backend.account.rank_unranked');
  });

  if (hasEmailAuth) {
    $a('btnChangePassword').onclick = async () => {
      const msg = $a('changePasswordMsg');
      msg.textContent = i18next.t('backend:backend.auth.sending'); msg.className = '';
      const { error } = await sb.auth.resetPasswordForEmail(currentUser.email, { redirectTo: location.href });
      if (error) { msg.textContent = error.message; msg.className = 'fail'; return; }
      msg.textContent = i18next.t('backend:backend.account.change_password_sent'); msg.className = 'ok';
    };
  }

  // suppression de compte (2026-07-13, demande explicite, voir supabase/migrations/*_delete_my_account.sql)
  // — le pseudo retapé doit correspondre EXACTEMENT à myPseudo pour activer le bouton final.
  const delBox = $a('acctDeleteConfirmBox');
  const delInput = $a('acctDeleteConfirmInput');
  const delBtn = $a('btnDeleteAccountConfirm');
  $a('btnDeleteAccount').onclick = () => { delBox.style.display = 'block'; delInput.value = ''; delBtn.disabled = true; delInput.focus(); };
  $a('btnDeleteAccountCancel').onclick = () => { delBox.style.display = 'none'; };
  delInput.addEventListener('input', () => { delBtn.disabled = delInput.value !== (myPseudo || ''); });
  delBtn.onclick = async () => {
    if (delInput.value !== (myPseudo || '')) return;
    const msg = $a('acctDeleteMsg');
    delBtn.disabled = true;
    msg.textContent = i18next.t('backend:backend.account.delete_account_deleting'); msg.className = '';
    const { error } = await sb.rpc('delete_my_account');
    if (error) { msg.textContent = error.message; msg.className = 'fail'; delBtn.disabled = false; return; }
    msg.textContent = i18next.t('backend:backend.account.delete_account_success'); msg.className = 'ok';
    setTimeout(async () => { await sb.auth.signOut(); location.reload(); }, 1500);
  };
}
// 2026-07-13 : #btnAccount (sidebar) retiré, doublon du header -- #btnAccountTopbar est câblé
// directement en HTML (onclick="openAccountPanel()", index.dev.html), pas besoin de le refaire ici.

