import React from "react";
export default function Insights({student}) {
 return <><div className="hero"><span className="pill">Student Learning Profile</span><h1>{student.name}</h1><p className="muted">Dynamic teaching parameters derived from observable performance and interaction signals.</p></div>
 <div className="grid grid-3" style={{marginTop:16}}>
  <div className="card"><h3>Pace</h3><div className="stat">Slow</div><p className="muted">Recent response patterns</p></div>
  <div className="card"><h3>Visual support</h3><div className="stat">High</div><p className="muted">Effective recent intervention</p></div>
  <div className="card"><h3>Guidance</h3><div className="stat">High</div><p className="muted">Frequent guided questions help</p></div>
 </div>
 <div className="card" style={{marginTop:16}}><h2>Misconceptions</h2><table><thead><tr><th>Concept</th><th>Signal</th><th>Action</th></tr></thead><tbody><tr><td>Inverse operations</td><td>Repeated sign/inverse errors</td><td>Balance-model example</td></tr><tr><td>Multi-step equations</td><td>Longer response time</td><td>Break into steps</td></tr></tbody></table></div></>
}