const encode = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
const digest = async value => encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
export function serviceURL(value) {
  const url=new URL(String(value).trim());
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('授權服務請填 HTTPS 網域，例如 https://memefinder-auth.example.workers.dev');
  return url.origin;
}
export const authMessage = code => ({
  session_missing:'請先完成一次 Google 授權。',session_expired:'這台裝置的登入已到期或登出，請重新授權。',
  reauthorization_required:'Google 授權已撤銷或失效，請重新授權；本機資料仍保留。',authorization_cancelled:'你已取消授權，可稍後再試。',
  login_expired_or_invalid:'登入流程已到期，請重新開始。',offline_permission_missing:'Google 未提供持續登入授權，請重新登入並允許存取。',
  drive_permission_missing:'尚未授權 Google Drive，請重新登入並勾選需要的權限。',account_not_allowed:'此帳號不在授權服務允許清單內。',
  service_not_configured:'授權服務尚未設定完成，請檢查 Worker 環境變數與 Secrets。',service_credentials_invalid:'授權服務的 Google Client ID 或 Secret 不正確。',
  origin_not_allowed:'授權服務的 APP_URL 與目前網站網址不一致。',wrong_service_origin:'請確認授權服務的 AUTH_URL 與實際網域一致。',
  too_many_login_attempts:'登入嘗試過於頻繁，請稍後再試。',account_changed:'授權帳號與目前圖庫不同，請先登出後再切換帳號。'
}[code] || '授權服務暫時無法連線，保留登入與本機資料，稍後會重試。');

// Only an opaque device session is persisted; Google access tokens remain in memory.
export class PersistentAuth {
  constructor({url,storage,onToken=()=>{},onIdentity=async()=>{},onState=()=>{},visible=()=>true}) {
    this.url=serviceURL(url);this.storage=storage;this.onToken=onToken;this.onIdentity=onIdentity;this.onState=onState;this.visible=visible;
    this.active=true;this.generation=0;this.session=null;this.token='';this.expires=0;this.state='idle';this.timer=null;this.flight=null;this.loginFlight=null;this.popup=null;this.expectedAccount='';
  }
  stateTo(state,message=''){this.state=state;this.onState(state,message);}
  async request(path,data={},credential='') {
    let res;try{res=await fetch(this.url+path,{method:'POST',headers:{'Content-Type':'application/json',...(credential?{Authorization:'Bearer '+credential}:{})},credentials:'omit',cache:'no-store',body:JSON.stringify(data),signal:AbortSignal.timeout(25000)});}catch{throw Object.assign(Error(authMessage('network')),{code:'network'});}
    let value;try{value=await res.json();}catch{throw Object.assign(Error(authMessage('network')),{code:'network'});}
    if(!res.ok)throw Object.assign(Error(authMessage(value.error)),{code:value.error,status:res.status});return value;
  }
  schedule(ms) {
    clearTimeout(this.timer);if(!this.active||!this.session)return;
    this.timer=setTimeout(()=>{if(this.visible())this.ensure().catch(()=>{});else this.schedule(30000);},Math.max(1000,ms));
  }
  async restore(expectedAccount='') {
    this.expectedAccount=expectedAccount;this.session=await this.storage.get('session');
    if(!this.active)return;
    const pending=await this.storage.get('pending');
    if(pending&&pending.expiresAt>Date.now())return this.completeLogin(pending);
    if(pending)await this.storage.remove('pending');
    if(!this.session){this.stateTo('needs-login','尚未建立持續登入，請按連線 Google 完成一次授權。');return;}
    if(expectedAccount&&this.session.account!==expectedAccount){this.stateTo('needs-login',authMessage('account_changed'));return;}
    return this.ensure();
  }
  ensure(rejectedToken='') {
    if(!this.active)return Promise.reject(Object.assign(Error('登入工作已取消'),{code:'cancelled'}));
    if(this.flight)return this.flight;
    if(!rejectedToken&&this.token&&this.expires>Date.now()+90000){this.onToken(this.token,(this.expires-Date.now())/1000);return Promise.resolve(this.token);}
    const generation=this.generation;this.stateTo('connecting','正在恢復 Google 連線…');
    this.flight=(async()=>{
      this.session=this.session||await this.storage.get('session');
      if(!this.session)throw Object.assign(Error(authMessage('session_missing')),{code:'session_missing',status:401});
      let value;
      for(let attempt=0;attempt<4;attempt++){
        try{value=await this.request('/session',rejectedToken?{rejectedToken}:{},this.session.token);break;}
        catch(e){if(e.code==='refresh_in_progress'&&attempt<3){await delay(700*(attempt+1));continue;}throw e;}
      }
      if(!this.active||generation!==this.generation)return '';
      if(value.account!==this.session.account||this.expectedAccount&&value.account!==this.expectedAccount)throw Object.assign(Error(authMessage('account_changed')),{code:'account_changed'});
      if(typeof value.accessToken!=='string'||!value.accessToken||!Number.isFinite(value.expiresAt)||value.expiresAt<=Date.now())throw Object.assign(Error(authMessage('network')),{code:'network'});
      await this.onIdentity({account:value.account,name:value.name});
      if(!this.active||generation!==this.generation)return '';
      this.token=value.accessToken;this.expires=value.expiresAt;this.onToken(this.token,(this.expires-Date.now())/1000);this.stateTo('connected');this.schedule(this.expires-Date.now()-85000);return this.token;
    })().catch(async e=>{
      if(!this.active||generation!==this.generation)throw e;
      if(e.status===401){this.session=null;this.token='';this.expires=0;await this.storage.remove('session');this.stateTo('needs-login',e.message);clearTimeout(this.timer);}
      else if(e.code==='account_changed'){this.stateTo('needs-login',e.message);clearTimeout(this.timer);}
      else{this.stateTo('offline',e.message);this.schedule(30000);}
      throw e;
    }).finally(()=>{this.flight=null;});return this.flight;
  }
  // The caller opens a window in its click handler before awaiting network work.
  async begin(popup,hint='') {
    if(this.loginFlight)throw Error('登入流程已啟動，請完成原本的授權視窗。');
    const proof=random(),generation=this.generation;this.popup=popup;this.stateTo('connecting','請在 Google 視窗完成一次授權');
    try {
      const started=await this.request('/auth/start',{challenge:await digest(proof),hint});
      if(!this.active||generation!==this.generation){popup?.close();return;}
      const pending={flow:started.flow,proof,expiresAt:started.expiresAt};await this.storage.set('pending',pending);
      const target=new URL(started.url);if(target.origin!=='https://accounts.google.com')throw Error('授權服務回傳無效的登入網址');
      if(popup&&!popup.closed)popup.location.href=target.href;else {location.assign(target.href);return;}
      return await this.completeLogin(pending);
    }catch(e){if(this.active)this.stateTo('needs-login',e.message);throw e;}
  }
  completeLogin(pending) {
    if(this.loginFlight)return this.loginFlight;
    const generation=this.generation;
    this.loginFlight=(async()=>{
      while(this.active&&generation===this.generation&&pending.expiresAt>Date.now()){
        if(!this.visible()){await delay(2000);continue;}
        let value;try{value=await this.request('/auth/result',{flow:pending.flow,proof:pending.proof});}
        catch(e){if(e.code==='network'||e.status>=500){this.stateTo('offline',e.message);await delay(4000);continue;}await this.storage.remove('pending');throw e;}
        if(!this.active||generation!==this.generation)return;
        if(value.pending){await delay(2000);continue;}
        if(!/^[\w-]{43}$/.test(value.sessionToken||'')||!value.account)throw Error('授權服務回傳資料不完整');
        this.session={token:value.sessionToken,account:value.account,name:value.name};await this.storage.set('session',this.session);await this.storage.remove('pending');
        this.expectedAccount=value.account;this.popup?.close();this.popup=null;return await this.ensure();
      }
      if(this.active){await this.storage.remove('pending');throw Error('登入流程已逾時，請重新連線 Google。');}
    })().catch(e=>{if(this.active)this.stateTo('needs-login',e.message);throw e;}).finally(()=>{this.loginFlight=null;});return this.loginFlight;
  }
  suspend(){this.active=false;this.generation++;clearTimeout(this.timer);this.token='';this.expires=0;this.popup?.close();this.popup=null;}
  async cancelLogin(){this.suspend();await Promise.allSettled([this.flight,this.loginFlight].filter(Boolean));await this.storage.remove('pending');}
  async logout() {
    this.suspend();await Promise.allSettled([this.flight,this.loginFlight].filter(Boolean));const session=this.session||await this.storage.get('session');let remoteCleared=true;
    try{if(session)await this.request('/logout',{},session.token);}catch{remoteCleared=false;}
    finally{await this.storage.remove('session');await this.storage.remove('pending');this.session=null;this.stateTo('signed-out','已手動登出，停止自動連線');}
    return remoteCleared;
  }
}
