import React from "react";
export default function RobotStatus({connected=true,state="idle"}) {
 return <div className="row"><span className="pill">{connected?"● ASCORA online":"○ ASCORA offline"}</span><span className="pill">{state}</span></div>
}