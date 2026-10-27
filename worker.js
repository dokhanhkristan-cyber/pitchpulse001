// PITCH PULSE Cloudflare Workers + SQLite-backed Durable Object (free-tier compatible).
const letters='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const uid=()=>crypto.randomUUID();
const clean=(v,n=40)=>String(v??'').replace(/[<>\r\n]/g,'').trim().replace(/\s+/g,' ').slice(0,n);
const err=error=>({ok:false,error});
async function hash(s){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
    const id=env.ROOMS.idFromName('pitchpulse-room-registry');
    return env.ROOMS.get(id).fetch(request);
  }
};
export class Rooms {
  constructor(state){this.state=state;}
  async fetch(req){
    const url=new URL(req.url);
    if(url.pathname==='/api/health')return response({ok:true});
    if(url.pathname==='/api/snapshot'){
      const token=url.searchParams.get('token');
      const s=await this.state.storage.get('session:'+token);
      if(!s)return response(err('Phiên hết hạn.'),401);
      const room=await this.state.storage.get('room:'+s.code);
      if(!room)return response(err('Không tìm thấy phòng.'),404);
      return response({ok:true,snapshot:this.snapshot(room,s)});
    }
    if(req.method!=='POST'||url.pathname!=='/api/action')return response(err('Not found'),404);
    let input;
    try{input=await req.json();}catch{return response(err('Yêu cầu không hợp lệ.'),400);}
    try{return response(await this.handle(input.event,input.payload||{},input.token));}
    catch(e){console.error(e);return response(err('Lỗi máy chủ.'),500);}
  }
  teamList(r){return Object.values(r.teams);}
  committed(r){return this.teamList(r).filter(t=>t.amount!==null);}
  common(r){
    const c=this.committed(r);
    const x={code:r.code,title:r.title,phase:r.phase,revealAt:r.revealAt,groupCount:this.teamList(r).length,investedCount:c.length};
    if(r.phase==='revealed')x.result={total:Math.round(c.reduce((n,t)=>n+t.amount,0)*100)/100,teams:this.teamList(r).map(t=>({id:t.id,name:t.name,amount:t.amount,demo:!!t.demo})).sort((a,b)=>(b.amount??-1)-(a.amount??-1)||a.name.localeCompare(b.name)),groupCount:x.groupCount,investedCount:x.investedCount};
    return x;
  }
  snapshot(r,s){
    const base=this.common(r);
    if(s.role==='host')return {...base,teams:this.teamList(r).map(t=>({id:t.id,name:t.name,submitted:t.amount!==null,demo:!!t.demo}))};
    const t=r.teams[s.teamId];return {...base,me:t?{id:t.id,name:t.name,amount:t.amount}:null};
  }
  async store(r){await this.state.storage.put('room:'+r.code,r);}
  async session(role,code,extras={}){const token=uid()+uid();await this.state.storage.put('session:'+token,{role,code,...extras});return token;}
  async handle(event,p,token){
    if(event==='host:create'){
      let code,existing;
      do{code=Array.from({length:6},()=>letters[Math.floor(Math.random()*letters.length)]).join('');existing=await this.state.storage.get('room:'+code);}while(existing);
      const r={code,title:clean(p.title,70)||'THE NEXT BIG IDEA',hostKey:uid()+uid(),phase:'open',revealAt:null,teams:{}};
      await this.store(r);return {ok:true,code,hostKey:r.hostKey,sessionToken:await this.session('host',code),snapshot:this.snapshot(r,{role:'host'})};
    }
    if(event==='host:resume'){
      const code=String(p.code||'').toUpperCase().trim(),r=await this.state.storage.get('room:'+code);
      if(!r||!p.hostKey||p.hostKey!==r.hostKey)return err('Mã phòng hoặc quyền Host không hợp lệ.');
      return {ok:true,sessionToken:await this.session('host',code),snapshot:this.snapshot(r,{role:'host'})};
    }
    if(event==='team:join'){
      const code=String(p.code||'').toUpperCase().trim(),name=clean(p.name),pin=String(p.pin??'');
      const r=await this.state.storage.get('room:'+code);
      if(!r)return err('Không tìm thấy phòng. Kiểm tra lại mã tham gia.');
      if(name.length<2||name.length>40)return err('Tên nhóm cần ít nhất 2 ký tự.');
      if(!/^\d{4}$/.test(pin))return err('PIN phải gồm đúng 4 chữ số.');
      let t=this.teamList(r).find(t=>t.name.toLocaleLowerCase()===name.toLocaleLowerCase());
      if(t){if(t.demo||t.pinHash!==await hash(code+':'+pin))return err('Tên nhóm đã tồn tại hoặc PIN không đúng.');}
      else{
        if(r.phase!=='open')return err('Phòng đã khóa đăng ký.');
        if(this.teamList(r).length>=100)return err('Phòng đã đủ 100 nhóm.');
        t={id:uid(),name,pinHash:await hash(code+':'+pin),amount:null,demo:false};r.teams[t.id]=t;await this.store(r);
      }
      return {ok:true,sessionToken:await this.session('team',code,{teamId:t.id}),snapshot:this.snapshot(r,{role:'team',teamId:t.id})};
    }
    const s=await this.state.storage.get('session:'+token);
    if(!s)return err('Phiên kết nối hết hạn. Vui lòng tải lại trang.');
    const r=await this.state.storage.get('room:'+s.code);
    if(!r)return err('Không tìm thấy phòng.');
    if(event==='team:invest'){
      const t=r.teams[s.teamId],amount=p.amount;
      if(s.role!=='team'||!t||t.demo)return err('Tài khoản nhóm không hợp lệ.');
      if(r.phase!=='open')return err('Đã khóa đầu tư.');
      if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>10||Math.abs(Math.round(amount*100)-amount*100)>1e-8)return err('Chọn số tiền từ 0 đến 10, tối đa 2 số thập phân.');
      t.amount=Math.round(amount*100)/100;await this.store(r);return {ok:true};
    }
    if(s.role!=='host')return err('Chỉ Host được thực hiện thao tác này.');
    if(event==='host:reveal'){
      if(r.phase!=='open')return err('Phòng không ở trạng thái nhận đầu tư.');
      if(!this.committed(r).length)return err('Chưa có nhóm nào đầu tư.');
      r.phase='countdown';r.revealAt=Date.now()+7500;await this.store(r);
      await this.state.storage.setAlarm(r.revealAt);return {ok:true};
    }
    if(event==='host:newProject'){
      if(r.phase==='countdown')return err('Vui lòng chờ kết thúc reveal.');
      r.title=clean(p.title,70)||'THE NEXT BIG IDEA';r.phase='open';r.revealAt=null;
      for(const t of this.teamList(r))t.amount=null;
      await this.store(r);return {ok:true};
    }
    if(event==='host:demo'){
      if(r.phase!=='open')return err('Chỉ có thể thêm nhóm demo khi đang mở đầu tư.');
      if(this.teamList(r).length+5>100)return err('Không đủ chỗ cho 5 nhóm demo.');
      ['Nova Ventures','Apex Capital','Moonshot Club','Orbit Labs','NextGen Fund'].forEach((name,i)=>{
        const label=this.teamList(r).some(t=>t.name===name)?name+' DEMO':name;
        const id=uid();r.teams[id]={id,name:label,pinHash:'',amount:[8.5,6,9.25,4.5,7.75][i],demo:true};
      });await this.store(r);return {ok:true};
    }
    if(event==='host:clearDemo'){
      if(r.phase!=='open')return err('Chỉ xóa demo trước lúc reveal.');
      for(const [id,t] of Object.entries(r.teams))if(t.demo)delete r.teams[id];
      await this.store(r);return {ok:true};
    }
    return err('Thao tác không tồn tại.');
  }
  async alarm(){
    const rooms=await this.state.storage.list({prefix:'room:'});
    for(const [key,r] of rooms){if(r.phase==='countdown'&&r.revealAt<=Date.now()){r.phase='revealed';r.revealAt=null;await this.state.storage.put(key,r);}}
  }
}
