(() => {
 const shapes={
 volume:'<path d="M4 9h4l5-4v14l-5-4H4zM16 8q4 4 0 8m3-11q7 7 0 14"/>',
 mute:'<path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6"/>',
 book:'<path d="M3 4h6q3 0 3 3 0-3 3-3h6v15h-6q-3 0-3 2 0-2-3-2H3zM12 7v14"/>',
 pause:'<path d="M7 5h3v14H7zM15 5h3v14h-3z" fill="currentColor" stroke="none"/>',
 coins:'<ellipse cx="10" cy="6" rx="7" ry="3"/><path d="M3 6v4c0 4 14 4 14 0V6M3 10v4q1 3 7 3m4-2q4 1 7-1v4c0 4-12 4-13 1v-2m10-8q5 1 3 4"/>',
 bolt:'<path d="M13.5 2 4 14h7l-.5 8L20 9h-7z" fill="currentColor" stroke="none"/>',
 squad:'<circle cx="10" cy="7" r="3"/><path d="M3 19v-2a6 6 0 0 1 12 0v2zM16 4a3 3 0 0 1 0 6m2 3q4 1 4 6h-4"/>',
 reticle:'<path d="M2 8V3h5m10 0h5v5m0 8v5h-5m-10 0H2v-5m6-4h8m-4-4v8"/>',
 clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l4 2"/>',
 flag:'<path d="M5 21V4q3-3 7 0t8 0v10q-4 3-8 0t-7 0"/>',
 home:'<path d="m2 11 10-8 10 8M5 10v10h14V10M10 20v-6h4v6"/>',
 minus:'<path d="M5 12h14"/>',plus:'<path d="M5 12h14M12 5v14"/>',
 radar:'<circle cx="12" cy="12" r="9"/><path d="M12 12 20 4M15.5 8.5A5 5 0 1 0 17 12"/>',
 factory:'<path d="M3 20V9l6 3V8l6 3 1-8h4l1 17zM6 16h2m3 0h2m3 0h2"/>',
 build:'<path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-6h6v6"/>',
 tank:'<path d="M3 14h15l3 3-3 3H5l-3-3zM6 14l2-5h7l2 5m-2-4 7-4M6 17h10"/>',
 queue:'<path d="M8 6h13M8 12h13M8 18h13M3 6h1m-1 6h1m-1 6h1"/>',
 move:'<path d="M12 2v20M2 12h20M9 5l3-3 3 3m-6 14 3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3"/>',
 attack:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.5"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6"/>',
 guard:'<path d="m12 2 8 3v7q-1 6-8 10-7-4-8-10V5zM8 12l3 3 5-7"/>',
 stop:'<path d="m8 3 8 0 5 5v8l-5 5H8l-5-5V8z"/><path d="M9 9h6v6H9z" fill="currentColor" stroke="none"/>',
 keyboard:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h1m2 0h1m2 0h1m2 0h1m2 0h1M5 12h2m2 0h2m2 0h2m2 0h2M8 16h8"/>',
 x:'<path d="m5 5 14 14M19 5 5 19"/>',play:'<path d="m8 4 12 8-12 8z"/>',mine:'<path d="m2 12 6-8 7 2 6 8-10 7zM8 4l3 17 4-15"/>',
 wrench:'<path d="M14 4a6 6 0 0 0-7 8l-5 6 4 4 6-7a6 6 0 0 0 8-8l-4 4-3-3 4-4z"/>',target:'<path d="M2 8V3h6m8 0h6v5m0 8v5h-6m-8 0H2v-5"/><circle cx="12" cy="12" r="3"/>',
 list:'<path d="M4 6h16M4 12h16M4 18h16"/>',time:'<path d="M6 2h12M6 22h12M7 3q0 5 5 9-5 4-5 9m10-18q0 5-5 9 5 4 5 9"/>',check:'<path d="m3 12 6 6L21 5"/>'
 };
 window.icon=n=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(shapes[n]||'')+'</svg>';
 document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=window.icon(el.dataset.icon);});
})();
