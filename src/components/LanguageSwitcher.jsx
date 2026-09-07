import React from "react";
export default function LanguageSwitcher({value="English",onChange}) {
 return <select value={value} onChange={e=>onChange?.(e.target.value)}><option>English</option><option>Hindi</option><option>Hinglish</option></select>
}