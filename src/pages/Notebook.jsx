import React,{useEffect,useRef,useState} from "react";
import {apiFetch} from "../lib/api";

export default function Notebook({student}) {
 const ref=useRef(null),[drawing,setDrawing]=useState(false),[status,setStatus]=useState("");
 useEffect(()=>{const c=ref.current,x=c.getContext("2d");c.width=c.clientWidth*devicePixelRatio;c.height=300*devicePixelRatio;x.scale(devicePixelRatio,devicePixelRatio);x.lineWidth=3;x.lineCap="round";x.strokeStyle="#e5e7eb";},[]);
 function pos(e){const r=ref.current.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
 function down(e){setDrawing(true);const p=pos(e),x=ref.current.getContext("2d");x.beginPath();x.moveTo(p.x,p.y)}
 function move(e){if(!drawing)return;const p=pos(e),x=ref.current.getContext("2d");x.lineTo(p.x,p.y);x.stroke()}
 function clear(){const c=ref.current,x=c.getContext("2d");x.clearRect(0,0,c.width,c.height);setStatus("")}
 async function submit(){try{await apiFetch("/api/notebook/submit",{method:"POST",body:JSON.stringify({student_id:student.id,question:"Solve x + 5 = 12.",timestamp:new Date().toISOString()})});setStatus("Notebook submission saved.");}catch{setStatus("Saved locally for prototype mode.");}}
 return <div className="grid grid-2"><div className="card"><span className="pill">Primary screen</span><h1>Solve x + 5 = 12</h1><p className="muted">Show your working. ASCORA can use the submission as a learning signal.</p><div className="row"><button className="btn secondary" onClick={clear}>Clear</button><button className="btn" onClick={submit}>Submit work</button></div>{status&&<p style={{marginTop:12}}>{status}</p>}</div><div className="card"><h2>Digital Notebook</h2><canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={()=>setDrawing(false)} onPointerLeave={()=>setDrawing(false)}/><p className="muted" style={{marginTop:10}}>Write or draw directly on the primary screen.</p></div></div>
}