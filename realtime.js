// Polling replaces Node.js SSE, works with free Cloudflare Durable Objects.
window.io=function io(){
 const handlers=new Map();let token=null,timer=null,last=null,connected=true;
 const api={connected:true,on(type,fn){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(fn);},timeout(ms){return {emit:async(event,payload,cb)=>{
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),ms);
  try{const res=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,payload,token}),signal:controller.signal});const data=await res.json();
   if(data.sessionToken){token=data.sessionToken;last=JSON.stringify(data.snapshot);clearInterval(timer);timer=setInterval(poll,1200);}
   cb(null,data);if(token)poll();
  }catch(e){api.connected=false;cb(e,null);}finally{clearTimeout(timeout);}
 }};}};
 function dispatch(name,value){for(const fn of handlers.get(name)||[])fn(value);}
 async function poll(){if(!token)return;try{const res=await fetch('/api/snapshot?token='+encodeURIComponent(token),{cache:'no-store'});const data=await res.json();if(!data.ok)return;
 const value=JSON.stringify(data.snapshot);if(value!==last){last=value;dispatch(data.snapshot.me?'team:snapshot':'host:snapshot',data.snapshot);}
 if(!connected){connected=true;api.connected=true;dispatch('connect');}
 }catch(e){if(connected){connected=false;api.connected=false;dispatch('disconnect');}}}
 queueMicrotask(()=>dispatch('connect'));return api;
};
