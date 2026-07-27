/* ---------------------------------------------------------------
   ICON SYSTEM
   Every icon is hand-built on a shared 100x100 grid: currentColor
   strokes at a constant weight, round joins, and exactly one filled
   gold accent so the set reads as one illustration family rather
   than an icon pack. Sub-shape helpers (wheel, roofline, pine, sun)
   keep repeated geometry identical across icons.
----------------------------------------------------------------*/
export const SW = 5;
export function svg(inner, sw){
  return '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="' + (sw || SW) +
         '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
}
export function G(d){ return '<path d="' + d + '" fill="var(--gold)" stroke="none"/>'; }
export function GR(x,y,w,h,r){ return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+(r==null?2:r)+'" fill="var(--gold)" stroke="none"/>'; }
export function GC(cx,cy,r){ return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="var(--gold)" stroke="none"/>'; }
export function wheel(cx,cy,r){ return '<circle cx="'+cx+'" cy="'+(cy==null?66:cy)+'" r="'+(r==null?8:r)+'" fill="var(--cream-2)"/>'; }
export function ground(y){ return '<path d="M9 '+(y==null?76:y)+'h82"/>'; }
export function pine(x,base,h){
  var w = h*0.42;
  return '<path d="M'+x+' '+(base-h)+' L'+(x-w)+' '+base+' h'+(2*w)+' Z"/>';
}
export function sun(cx,cy,r){
  var s='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="var(--gold)" stroke="none"/>';
  return s;
}

/* ---------------------------------------------------------------
   ITEM DATA
   One flat array. Adding an item is one object; nothing else in the
   app needs to know about it.
----------------------------------------------------------------*/
export const ITEMS = [

/* ============== CARS & WHEELS ============== */
{
  id:'camry', name:'Toyota Camry', price:28000, category:'Cars & Wheels',
  blurb:"The responsible choice you'll regret.",
  svg: svg(
    '<path d="M11 66V57c0-4 3-7 7-7h5l8-11c2-3 5-4 8-4h22c3 0 6 1 8 4l8 11h5c4 0 7 3 7 7v9"/>' +
    G('M40 48l5-8h11l5 8z') +
    '<path d="M23 50h54"/>' +
    wheel(31) + wheel(69) + ground(),
  )
},
{
  id:'model3', name:'Tesla Model 3', price:42000, category:'Cars & Wheels',
  blurb:'Silent, smug, always hunting for a plug.',
  svg: svg(
    '<path d="M11 66V58c0-3 2-6 5-7l12-4 9-9c2-2 4-3 7-3h16c3 0 5 1 7 3l9 9 12 4c3 1 5 4 5 7v8"/>' +
    '<path d="M28 47h44"/>' +
    G('M52 20l-9 15h7l-3 12 11-16h-7z') +
    wheel(31) + wheel(69) + ground(),
  )
},
{
  id:'lexus-rx', name:'Lexus RX', price:58000, category:'Cars & Wheels',
  blurb:'A Camry that went to business school.',
  svg: svg(
    '<path d="M11 65V52c0-3 2-6 6-6h4l7-13c2-3 5-5 9-5h26c4 0 7 2 9 5l7 13h4c4 0 6 3 6 6v13"/>' +
    '<path d="M21 46h58"/>' +
    G('M35 44l5-10h20l5 10z') +
    '<path d="M17 56h9M74 56h9"/>' +
    wheel(31) + wheel(69) + ground(),
  )
},
{
  id:'porsche', name:'Porsche 911', price:132000, category:'Cars & Wheels',
  blurb:'Two seats, zero excuses, one midlife crisis.',
  svg: svg(
    '<path d="M9 67v-5c0-4 3-7 7-8l10-2c6-9 14-14 24-14s18 5 24 14l10 2c4 1 7 4 7 8v5"/>' +
    G('M36 44c4-6 9-9 14-9s10 3 14 9z') +
    '<path d="M78 52h9"/>' +
    wheel(29) + wheel(71) + ground(),
  )
},
{
  id:'range-rover', name:'Range Rover Autobiography', price:110000, category:'Cars & Wheels',
  blurb:'Boxy, smug, and allergic to actual dirt roads.',
  svg: svg(
    '<path d="M13 64V36c0-3 2-5 5-5h47c3 0 5 2 5 5v10h9c3 0 5 2 5 5v13"/>' +
    '<path d="M13 46h57"/>' +
    '<path d="M40 31v15"/>' +
    GR(16,52,12,7,2) + GR(72,52,10,7,2) +
    wheel(31) + wheel(69) + ground()
  )
},
{
  id:'mustang', name:"'67 Mustang, restored", price:85000, category:'Cars & Wheels',
  blurb:"Unreliable in a way you'll defend at parties.",
  svg: svg(
    '<path d="M9 64V54c0-3 2-6 5-6h28l12-13c2-2 4-3 7-3h11c4 0 7 3 8 7l3 9c4 1 6 3 6 6v6"/>' +
    '<path d="M45 48h33"/>' +
    GR(17,50,20,5,2) +
    wheel(28) + wheel(70) + ground()
  )
},
{
  id:'jet-share', name:'Private jet, 1/16 share', price:650000, category:'Cars & Wheels',
  blurb:"You still can't bring a full-size shampoo.",
  svg: svg(
    '<path d="M50 8c4 0 7 6 7 14v13l32 18v9l-32-9v14l10 8v7l-17-5-17 5v-7l10-8V53l-32 9v-9l32-18V22c0-8 3-14 7-14z"/>' +
    GC(50,24,4)
  )
},

/* ============== REAL ESTATE ============== */
{
  id:'starter-home', name:'Pay off the starter home', price:240000, category:'Real Estate',
  blurb:'The least fun, most freeing purchase on this board.',
  svg: svg(
    '<path d="M18 48L50 22l32 26"/>' +
    '<path d="M25 44v32h50V44"/>' +
    GR(43,56,14,20,1) +
    '<path d="M25 76h50"/>' +
    '<path d="M64 30V22h8v14"/>',
  )
},
{
  id:'parents-mortgage', name:"Parents' mortgage, gone", price:310000, category:'Real Estate',
  blurb:'Instant favorite-child status. Permanent.',
  svg: svg(
    '<path d="M16 50L50 24l34 26"/>' +
    '<path d="M24 46v30h52V46"/>' +
    '<path d="M24 76h52"/>' +
    G('M50 72c-9-6-14-11-14-17 0-5 4-8 8-8 3 0 5 1 6 3 1-2 3-3 6-3 4 0 8 3 8 8 0 6-5 11-14 17z'),
  )
},
{
  id:'tahoe-cabin', name:'Lakefront cabin, Lake Tahoe NV', price:2800000, category:'Real Estate',
  blurb:'Five bedrooms, one dock, zero cell service.',
  svg: svg(
    '<path d="M30 62V38L52 20l22 18v24"/>' +
    '<path d="M24 42L52 19l28 23"/>' +
    GR(45,48,14,14,1) +
    pine(15,62,22) + pine(88,62,18) +
    '<path d="M10 70c6-3 10 3 16 0s10 3 16 0 10 3 16 0 10 3 16 0 10 3 16 0"/>' +
    '<path d="M10 80c6-3 10 3 16 0s10 3 16 0 10 3 16 0 10 3 16 0 10 3 16 0"/>',
    4.6
  )
},
{
  id:'santa-barbara', name:'Beachfront house, Santa Barbara CA', price:4200000, category:'Real Estate',
  blurb:'Five bedrooms and a permanent salt smell.',
  svg: svg(
    sun(80,24,10) +
    '<path d="M18 46L50 24l32 22"/>' +
    '<path d="M26 43v23h48V43"/>' +
    '<path d="M36 52h12v14H36zM58 52h10v9H58z"/>' +
    '<path d="M22 66h56"/>' +
    '<path d="M10 76c6-4 11 4 17 0s11 4 17 0 11 4 17 0 11 4 17 0"/>' +
    '<path d="M10 86c6-4 11 4 17 0s11 4 17 0 11 4 17 0 11 4 17 0"/>',
    4.6
  )
},
{
  id:'aspen-chalet', name:'Ski chalet, Aspen CO', price:6500000, category:'Real Estate',
  blurb:'Five bedrooms, and you ski maybe four days a year.',
  svg: svg(
    '<path d="M6 44L26 20l14 16"/>' +
    '<path d="M56 40L74 18l20 26"/>' +
    G('M26 20l7 8H19zM74 18l6 8H68z') +
    '<path d="M32 78V54l20-16 20 16v24"/>' +
    '<path d="M26 56L52 35l26 21"/>' +
    '<path d="M46 78V62h12v16"/>' +
    '<path d="M20 84h64"/>',
    4.6
  )
},
{
  id:'nyc-penthouse', name:'NYC penthouse', price:12500000, category:'Real Estate',
  blurb:'Park views, and neighbors who own small countries.',
  svg: svg(
    '<path d="M14 86V44h20v42M66 86V52h20v34"/>' +
    '<path d="M38 86V22c0-2 2-4 4-4h16c2 0 4 2 4 4v64"/>' +
    GR(44,26,12,10,1) +
    '<path d="M44 46h12M44 58h12M44 70h12"/>' +
    '<path d="M20 56h8M20 68h8M72 62h8M72 74h8"/>' +
    '<path d="M8 86h84"/>',
    4.6
  )
},
{
  id:'private-island', name:'Private island', price:28000000, category:'Real Estate',
  blurb:'Sounds great until the generator dies.',
  svg: svg(
    sun(80,22,9) +
    '<path d="M40 62V34"/>' +
    '<path d="M40 34c-8-6-16-5-20 1 7-3 12-2 15 1M40 34c8-6 17-5 21 1-8-3-13-2-16 1M40 34c-3-9 1-16 8-17-4 5-5 10-4 14"/>' +
    '<path d="M16 66c8-6 18-8 26-8s18 2 26 8"/>' +
    '<path d="M8 76c6-4 11 4 17 0s11 4 17 0 11 4 17 0 11 4 17 0"/>' +
    '<path d="M8 86c6-4 11 4 17 0s11 4 17 0 11 4 17 0 11 4 17 0"/>',
    4.6
  )
},

/* ============== TRAVEL & EXPERIENCES ============== */
{
  id:'safari', name:'Two-week safari, Botswana', price:68000, category:'Travel & Experiences',
  blurb:'The elephants do not care that you are rich.',
  svg: svg(
    sun(74,26,10) +
    '<path d="M22 74V56c0-11 9-20 20-20h8c11 0 20 9 20 20v18"/>' +
    '<path d="M34 74V62M58 74V62"/>' +
    '<path d="M22 44c-7-4-12-1-12 5s6 9 12 6"/>' +
    '<path d="M46 56c0 8-3 12-3 18"/>' +
    '<circle cx="34" cy="46" r="2" fill="currentColor" stroke="none"/>' +
    ground(80),
    4.6
  )
},
{
  id:'rtw-trip', name:'Round-the-world trip, first class', price:145000, category:'Travel & Experiences',
  blurb:'Eleven countries, one very tired passport.',
  svg: svg(
    '<circle cx="46" cy="56" r="28"/>' +
    '<path d="M18 56h56"/>' +
    '<ellipse cx="46" cy="56" rx="13" ry="28"/>' +
    G('M94 8L58 27l14 5 4 14z'),
    4.6
  )
},
{
  id:'superbowl', name:'Super Bowl suite, 12 seats', price:375000, category:'Travel & Experiences',
  blurb:'Your friend list is about to get interesting.',
  svg: svg(
    '<ellipse cx="50" cy="60" rx="40" ry="23"/>' +
    '<ellipse cx="50" cy="60" rx="25" ry="13"/>' +
    '<path d="M50 47v26"/>' +
    '<ellipse cx="50" cy="27" rx="15" ry="10" fill="var(--gold)" stroke="none"/>' +
    '<path d="M44 27h12M47 24v6M53 24v6" stroke="var(--cream-2)" stroke-width="2.8"/>',
    4.6
  )
},
{
  id:'blue-origin', name:'Blue Origin seat', price:900000, category:'Travel & Experiences',
  blurb:'Eleven minutes of weightlessness. Bring a playlist.',
  svg: svg(
    '<path d="M50 12c10 10 15 24 15 38v18H35V50c0-14 5-28 15-38z"/>' +
    '<circle cx="50" cy="40" r="7"/>' +
    '<path d="M35 56L22 68v10l13-8M65 56l13 12v10l-13-8"/>' +
    G('M42 70h16c0 10-4 18-8 22-4-4-8-12-8-22z'),
    4.6
  )
},
{
  id:'yacht-charter', name:'Month-long yacht charter', price:1200000, category:'Travel & Experiences',
  blurb:'The crew will be noticeably more competent than you.',
  svg: svg(
    '<path d="M12 62h76l-10 14H22z"/>' +
    '<path d="M26 62V48h34v14"/>' +
    '<path d="M38 48V36h16v12"/>' +
    GR(31,52,8,6,1) + GR(46,52,8,6,1) +
    '<path d="M46 36V22h12"/>' +
    '<path d="M8 84c6-4 11 4 17 0s11 4 17 0 11 4 17 0 11 4 17 0"/>',
    4.6
  )
},
{
  id:'private-concert', name:'Private show, one very famous band', price:2000000, category:'Travel & Experiences',
  blurb:'Play the hits. Please just play the hits.',
  svg: svg(
    '<path d="M40 20v34"/>' +
    '<path d="M40 20l26-6v34"/>' +
    '<ellipse cx="31" cy="58" rx="10" ry="8"/>' +
    '<ellipse cx="57" cy="50" rx="10" ry="8"/>' +
    G('M14 84l10-16h6l-8 16zM86 84l-10-16h-6l8 16z'),
    4.6
  )
},

/* ============== EVERYDAY SPLURGES ============== */
{
  id:'espresso', name:'La Marzocco espresso setup', price:22000, category:'Everyday Splurges',
  blurb:'Now you can be disappointed at home.',
  svg: svg(
    '<path d="M20 16h50a5 5 0 0 1 5 5v33H15V21a5 5 0 0 1 5-5z"/>' +
    '<path d="M15 54h60"/>' +
    GC(29,33,7) +
    '<path d="M50 54v6"/>' +
    '<path d="M39 60h22l-3 7H42z"/>' +
    '<path d="M61 63h15"/>' +
    '<path d="M42 76h16v5a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z"/>' +
    '<path d="M58 78h5a5 5 0 0 1 0 9h-5"/>' +
    '<path d="M17 90h66"/>',
    4.6
  )
},
{
  id:'rolex', name:'Rolex Daytona', price:38000, category:'Everyday Splurges',
  blurb:'Tells time. Mostly tells other things.',
  svg: svg(
    '<circle cx="50" cy="50" r="24"/>' +
    '<circle cx="50" cy="50" r="31"/>' +
    G('M50 34a3 3 0 0 1 3 3v13h9a3 3 0 0 1 0 6H50a3 3 0 0 1-3-3V37a3 3 0 0 1 3-3z') +
    '<path d="M36 22l3-10h22l3 10M36 78l3 10h22l3-10"/>',
    4.6
  )
},
{
  id:'wardrobe', name:'A full designer wardrobe', price:65000, category:'Everyday Splurges',
  blurb:"You'll still reach for the same hoodie.",
  svg: svg(
    '<path d="M10 18h80"/>' +
    '<path d="M36 18v7M70 18v8"/>' +
    '<path d="M36 25L22 37l6 7 4-3v43h26V41l4 3 6-7z"/>' +
    '<path d="M70 26l-7 10v48h17V36z"/>' +
    GR(65,50,7,8,1),
    4.6
  )
},
{
  id:'home-theater', name:'Home theater build-out', price:95000, category:'Everyday Splurges',
  blurb:'Fall asleep in 7.1 surround sound.',
  svg: svg(
    '<rect x="12" y="16" width="76" height="44" rx="3"/>' +
    G('M42 28l18 10-18 10z') +
    '<path d="M20 74v-4a5 5 0 0 1 5-5h10a5 5 0 0 1 5 5v4M60 74v-4a5 5 0 0 1 5-5h10a5 5 0 0 1 5 5v4"/>' +
    '<path d="M14 74h72v10H14z"/>',
    4.6
  )
},
{
  id:'chefs-kitchen', name:"Chef's kitchen renovation", price:145000, category:'Everyday Splurges',
  blurb:'The takeout apps remain undeleted.',
  svg: svg(
    '<path d="M22 40h56v44H22z"/>' +
    '<path d="M22 56h56"/>' +
    '<circle cx="36" cy="48" r="4"/><circle cx="52" cy="48" r="4"/>' +
    GC(68,48,4) +
    '<rect x="34" y="64" width="32" height="14" rx="2"/>' +
    '<path d="M30 40V24c0-3 2-5 5-5h30c3 0 5 2 5 5v16"/>' +
    '<path d="M18 84h64"/>',
    4.6
  )
},
{
  id:'pool-cabana', name:'Backyard pool and cabana', price:180000, category:'Everyday Splurges',
  blurb:'A hole in the ground you fill with money.',
  svg: svg(
    sun(80,22,9) +
    '<path d="M14 50h58a6 6 0 0 1 6 6v26H14z"/>' +
    '<path d="M20 62c6-4 11 4 17 0s11 4 17 0 11 4 17 0"/>' +
    '<path d="M20 74c6-4 11 4 17 0s11 4 17 0 11 4 17 0"/>' +
    '<path d="M62 50V38h12"/>' +
    '<path d="M62 44h12"/>',
    4.6
  )
},

/* ============== GROWN-UP MOVES ============== */
{
  id:'student-loans', name:'Wipe out the student loans', price:58000, category:'Grown-Up Moves',
  blurb:"A weight you only notice once it's gone.",
  svg: svg(
    '<path d="M24 12h40l14 14v62H24z"/>' +
    '<path d="M64 12v14h14"/>' +
    G('M64 12l14 14H64z') +
    '<path d="M34 44h32M34 56h32M34 68h20"/>' +
    '<path d="M16 86L84 18" stroke="var(--red)" stroke-width="6.5"/>',
    4.6
  )
},
{
  id:'emergency-fund', name:'Emergency fund, twelve months', price:72000, category:'Grown-Up Moves',
  blurb:'Boring. Load-bearing.',
  svg: svg(
    '<path d="M10 50a40 32 0 0 1 80 0z"/>' +
    '<path d="M50 50v26a8 8 0 0 1-16 0"/>' +
    G('M50 12a6 6 0 0 1 6 6h-12a6 6 0 0 1 6-6z') +
    '<path d="M22 66l-4 8M40 72l-3 6M74 64l4 8"/>',
    4.6
  )
},
{
  id:'year-off', name:'A full year off work', price:120000, category:'Grown-Up Moves',
  blurb:'The most expensive thing on this board is time.',
  svg: svg(
    '<path d="M24 12h52M24 88h52"/>' +
    '<path d="M30 12v10c0 12 20 20 20 28s-20 16-20 28v10M70 12v10c0 12-20 20-20 28s20 16 20 28v10"/>' +
    G('M34 18h32c0 9-16 15-16 22 0-7-16-13-16-22z') +
    G('M50 60c0 8 14 12 15 22H35c1-10 15-14 15-22z')
  )
},
{
  id:'college-529', name:'529 college fund, two kids', price:400000, category:'Grown-Up Moves',
  blurb:'Future them says thanks. Present them wants a snack.',
  svg: svg(
    '<path d="M14 38L50 22l36 16-36 16z"/>' +
    '<path d="M30 45v16c0 5 9 9 20 9s20-4 20-9V45"/>' +
    G('M78 42v20a4 4 0 0 1-8 0V42z') +
    '<path d="M22 76h56M30 86h40"/>',
    4.6
  )
},
{
  id:'retirement-max', name:'Max out retirement, forever', price:250000, category:'Grown-Up Moves',
  blurb:'Compounding is the only real magic trick.',
  svg: svg(
    '<path d="M24 40h30c14 0 24 9 24 20 0 6-3 11-8 15v9h-10v-5a30 30 0 0 1-12 0v5H38v-9c-6-4-10-10-10-17"/>' +
    '<path d="M24 40c-6-2-10-7-10-13 8 0 14 3 16 8"/>' +
    '<circle cx="62" cy="56" r="2.6" fill="currentColor" stroke="none"/>' +
    GC(44,32,9) +
    '<path d="M44 26v12M41 30h6" stroke="var(--cream-2)" stroke-width="2.6"/>',
    4.6
  )
},
{
  id:'index-fund', name:'Index fund lump sum', price:1000000, category:'Grown-Up Moves',
  blurb:'Do nothing for twenty years. Aggressively.',
  svg: svg(
    '<path d="M16 84V20M16 84h68"/>' +
    GR(28,58,10,26,2) + GR(46,44,10,40,2) + GR(64,28,10,56,2) +
    '<path d="M26 66l16-14 16-12 20-22"/>' +
    '<path d="M66 18h16v16"/>',
    4.6
  )
},

/* ============== GIVING BACK ============== */
{
  id:'donate', name:'Donate to a cause you love', price:500000, category:'Giving Back',
  blurb:'The rare purchase with no buyer’s remorse.',
  svg: svg(
    G('M50 44c-12-9-19-15-19-24 0-7 5-12 11-12 4 0 7 2 8 5 1-3 4-5 8-5 6 0 11 5 11 12 0 9-7 15-19 24z') +
    '<path d="M14 60c6-6 14-6 20-1l8 7h12a5 5 0 0 1 0 10H50"/>' +
    '<path d="M42 66l24-6c5-1 9 1 10 5s-1 7-6 9l-26 10c-5 2-9 2-14-1L14 74"/>',
    4.6
  )
},
{
  id:'scholarship', name:'Endow a scholarship', price:1500000, category:'Giving Back',
  blurb:'Your name on a building is optional.',
  svg: svg(
    '<path d="M30 12h40v34a6 6 0 0 1-9 5l-11-7-11 7a6 6 0 0 1-9-5z"/>' +
    G('M50 62a18 18 0 1 1 0 36 18 18 0 0 1 0-36z') +
    '<path d="M50 70l3.5 7 7.5 1-5.5 5 1.5 8-6.5-4-6.5 4 1.5-8-5.5-5 7.5-1z" fill="var(--green-800)" stroke="none"/>',
    4.6
  )
}
];

export const CATEGORIES = [
  { name:'Cars & Wheels',        note:'Depreciating, beloved.' },
  { name:'Real Estate',          note:'Where the real money goes to die.' },
  { name:'Travel & Experiences', note:'You will post about all of it.' },
  { name:'Everyday Splurges',    note:'Small on this list. Insane in real life.' },
  { name:'Grown-Up Moves',       note:'The boring ones that actually work.' },
  { name:'Giving Back',          note:'Look at you.' }
];
