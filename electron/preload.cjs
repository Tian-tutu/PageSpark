const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('reading',{
 call:(action,value)=>ipcRenderer.invoke('reading',action,value),
 on:(channel,callback)=>{if(['next-quote','presented','open-quote'].includes(channel))ipcRenderer.on(channel,(_event,value)=>callback(value));}
});
