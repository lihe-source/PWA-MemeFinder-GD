// Mirrors the attached Japanese PWA's session-only GIS token model.
// No refresh tokens, backend, credentials in backups, or automatic OAuth popups.
export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive';
export const reconnectError=()=>Object.assign(Error('Google 授權需要更新，請按右上「重新連線」；帳號、標記及待同步資料仍保留。'),{code:'RECONNECT_REQUIRED'});
export class BrowserAuth {
  constructor({clientId,storage,key,oauth=()=>globalThis.google?.accounts?.oauth2,onIdentity=async()=>{},onToken=()=>{},onState=()=>{},now=()=>Date.now(),timeout=30000}) {
    Object.assign(this,{clientId,storage,key,oauth,onIdentity,onToken,onState,now,timeout});this.session=null;this.active=true;this.epoch=0;this.flight=null;this.restoreFlight=null;this.timer=null;this.cancel=null;this.expected='';
  }
  read(){try{return JSON.parse(this.storage.getItem(this.key)||'null');}catch{return null;}}
  write(s){try{s?this.storage.setItem(this.key,JSON.stringify(s)):this.storage.removeItem(this.key);}catch{/* Session storage disabled: keep this page working in memory. */}}
  valid(s){return !!s&&s.clientId===this.clientId&&s.scope===DRIVE_SCOPE&&typeof s.token==='string'&&!!s.token&&typeof s.account==='string'&&!!s.account&&Number.isFinite(s.expires)&&s.expires>this.now()+30000;}
  state(name,message=''){if(this.active)this.onState(name,message);}
  invalidate(){this.session=null;this.write(null);clearTimeout(this.timer);this.state('remembered',reconnectError().message);}
  arm(){clearTimeout(this.timer);if(!this.active||!this.session)return;this.timer=setTimeout(()=>this.invalidate(),Math.max(0,this.session.expires-this.now()-30000));}
  async apply(s,epoch){await this.onIdentity({account:s.account,name:s.name||s.account});if(!this.active||epoch!==this.epoch)throw Error('登入設定已變更');this.session=s;this.onToken(s.token,(s.expires-this.now())/1000);this.state('connected');this.arm();return s.token;}
  restore(account='') {
    if(!this.active)return Promise.resolve(false);
    if(this.restoreFlight)return this.restoreFlight;
    this.expected=account;const epoch=this.epoch,s=this.session||this.read();
    if(!this.valid(s)||account&&s.account!==account){this.invalidate();return Promise.resolve(false);}
    this.restoreFlight=this.apply(s,epoch).then(()=>true).finally(()=>{this.restoreFlight=null;});return this.restoreFlight;
  }
  async ensure(rejected='') {
    if(!this.active)throw reconnectError();
    if(this.flight)return this.flight;
    if(rejected&&this.session?.token===rejected){this.invalidate();throw reconnectError();}
    if(await this.restore(this.expected))return this.session.token;
    throw reconnectError();
  }
  // Call directly in a click handler, before any awaited work (Safari user activation).
  connect(account='') {
    if(!this.active)return Promise.reject(Error('登入流程已停止'));
    if(this.flight)return this.flight;
    const api=this.oauth();if(!api)return Promise.reject(Error('Google 登入元件準備中，請稍候再按一次；請確認網路。'));
    const epoch=this.epoch;this.expected=account;this.state('connecting','請完成 Google 授權');
    let resolve,reject,settled=false,timer;
    const flight=new Promise((yes,no)=>{resolve=yes;reject=no;});this.flight=flight;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);this.cancel=null;this.flight=null;if(error){this.epoch++;this.state('remembered',error.message);reject(error);}else resolve(value);};
    this.cancel=()=>finish(Error('登入流程已取消'));
    timer=setTimeout(()=>finish(Error('Google 授權逾時，請再按重新連線；本機資料保留。')),this.timeout);
    try {
      const client=api.initTokenClient({client_id:this.clientId,scope:DRIVE_SCOPE,include_granted_scopes:true,
        callback:async response=>{
          if(settled||!this.active||epoch!==this.epoch)return;
          try{
            if(response.error)throw Error('Google 授權未完成：'+response.error);
            if(!response.access_token||!(Number(response.expires_in)>30)||api.hasGrantedAllScopes&&!api.hasGrantedAllScopes(response,DRIVE_SCOPE))throw Error('請允許 Google Drive 存取權限後重新連線。');
            const expires=this.now()+Number(response.expires_in)*1000;
            const res=await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,permissionId)',{headers:{Authorization:'Bearer '+response.access_token},signal:AbortSignal.timeout(15000)});
            if(!res.ok)throw Error('無法確認 Google 帳號，請稍後重新連線；本機資料保留。');
            const {user}=await res.json(),identity=user?.emailAddress||user?.permissionId;
            if(!identity)throw Error('Google 未回傳帳號資訊');
            if(account&&identity!==account)throw Error('請使用原本的 Google 帳號；要切換帳號請先登出。');
            if(settled||!this.active||epoch!==this.epoch)return;
            const s={clientId:this.clientId,scope:DRIVE_SCOPE,token:response.access_token,expires,account:identity,name:user.displayName||identity};
            await this.apply(s,epoch);
            if(settled||!this.active||epoch!==this.epoch)return;
            this.write(s);finish(null,s.token);
          }catch(e){finish(e);}
        },error_callback:e=>finish(Error(e?.type==='popup_closed'?'已取消 Google 登入；本機資料保留。':e?.type==='popup_failed_to_open'?'瀏覽器未開啟登入視窗，請直接點擊重新連線。':'Google 登入未完成，請重新連線。'))});
      client.requestAccessToken({prompt:account?'':'select_account',...(account?{login_hint:account}:{})});
    }catch(e){finish(e);}
    return flight;
  }
  suspend(){this.active=false;this.epoch++;clearTimeout(this.timer);this.cancel?.();this.session=null;}
  logout(){this.write(null);this.suspend();}
}
