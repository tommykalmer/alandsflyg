// ===================== PORTAL + ANALYS =====================
// Samma filer körs på den egna sajten (GitHub Pages) och på spelportaler (CrazyGames).
// Portalläge = alla värdar som inte är våra, eller ?portal=1 för test.
//  - Portal: CrazyGames SDK v3 (gameplay start/stop, midgame-annons vid naturliga pauser,
//    happytime vid klarat uppdrag). Ingen Google Analytics.
//  - Egen sajt: Google Analytics efter samtycke (sätt GA_MEASUREMENT_ID nedan).
const PORTAL = /[?&]portal=1/.test(location.search) ||
  !(/github\.io$/.test(location.hostname) || /alandsflyg/.test(location.hostname) ||
    location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');

const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';   // TODO: klistra in Ålandsflygs GA4-ID

/* ---------- CrazyGames SDK shim (portal build) ----------
   Works on CrazyGames and degrades to no-ops anywhere else.
   CG.init() must be awaited before boot. */
const CG = (()=>{
  let sdk = null, inGame = false, adBusy = false;
  const api = {
    ready:false,
    async init(){
      try{
        if (window.CrazyGames && window.CrazyGames.SDK){
          await window.CrazyGames.SDK.init();
          sdk = window.CrazyGames.SDK;
          api.ready = sdk.environment !== "disabled";
        }
      }catch(e){ sdk = null; api.ready = false; }
      return api.ready;
    },
    loadingStart(){ try{ sdk && sdk.game.loadingStart(); }catch(e){} },
    loadingStop(){ try{ sdk && sdk.game.loadingStop(); }catch(e){} },
    start(){ if (inGame) return; inGame = true; try{ sdk && sdk.game.gameplayStart(); }catch(e){} },
    stop(){ if (!inGame) return; inGame = false; try{ sdk && sdk.game.gameplayStop(); }catch(e){} },
    happy(){ try{ sdk && sdk.game.happytime(); }catch(e){} },
    /* Interstitial at a natural break. onPause/onResume mute & freeze the game. */
    midgame(onPause, onResume){
      if (!sdk || adBusy) return;
      adBusy = true;
      const done = ()=>{ adBusy = false; try{ onResume && onResume(); }catch(e){} };
      try{
        sdk.ad.requestAd("midgame", {
          adStarted(){ try{ onPause && onPause(); }catch(e){} },
          adFinished: done,
          adError: done,
        });
      }catch(e){ done(); }
    },
    inviteLink(params){ try{ return sdk ? sdk.game.inviteLink(params) : null; }catch(e){ return null; } },
    inviteParam(name){
      try{ if (sdk){ const v = sdk.game.getInviteParam(name); if (v) return v; } }catch(e){}
      try{ return new URLSearchParams(location.search).get(name); }catch(e){ return null; }
    },
    getItem(k){ try{ return sdk ? sdk.data.getItem(k) : localStorage.getItem(k); }catch(e){ return null; } },
    setItem(k, v){ try{ sdk ? sdk.data.setItem(k, v) : localStorage.setItem(k, v); }catch(e){} },
  };
  return api;
})();

if (PORTAL) {
  const s = document.createElement('script');
  s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
  s.onload = () => CG.init().then(() => { if (CG.ready) { if (window.__afReady) CG.loadingStop(); else CG.loadingStart(); } });
  document.head.appendChild(s);
}

// ---------- Google Analytics (bara egen sajt, efter samtycke) ----------
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
let gaLoaded = false;
function loadGA() {
  if (gaLoaded || GA_MEASUREMENT_ID.indexOf('XXXX') !== -1) return;
  gaLoaded = true;
  const s = document.createElement('script');
  s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
  document.head.appendChild(s);
  gtag('js', new Date()); gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
}
function trackEvent(name, params) { if (gaLoaded) gtag('event', name, params || {}); }
function initConsent() {
  if (PORTAL || GA_MEASUREMENT_ID.indexOf('XXXX') !== -1) return;
  let c = null; try { c = localStorage.getItem('alandsflyg.gaConsent'); } catch (e) {}
  if (c === 'yes') { loadGA(); return; }
  if (c === 'no') return;
  const bar = document.getElementById('consent'); if (!bar) return;
  bar.hidden = false;
  const set = v => { try { localStorage.setItem('alandsflyg.gaConsent', v); } catch (e) {} bar.hidden = true; if (v === 'yes') loadGA(); };
  document.getElementById('consentYes').onclick = () => set('yes');
  document.getElementById('consentNo').onclick = () => set('no');
}
document.addEventListener('DOMContentLoaded', initConsent);
