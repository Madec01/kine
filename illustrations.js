/* Illustrations schématiques originales : elles ne remplacent pas les consignes. */
window.KineArt = (() => {
 const palettes={sage:{bg:'#edf2e6',circle:'#e3ead6',shirt:'#8fa47a',pants:'#768474',accent:'#afb98a'},sand:{bg:'#f6f0e5',circle:'#eee4d0',shirt:'#c7a271',pants:'#8a8975',accent:'#c7ac80'},blue:{bg:'#eaf0f1',circle:'#dce6e7',shirt:'#94b0b1',pants:'#768e95',accent:'#a1b9ba'},rose:{bg:'#f5ece8',circle:'#efe0d9',shirt:'#c2a18f',pants:'#988d86',accent:'#c9b6a2'},lavender:{bg:'#efedf3',circle:'#e4dfea',shirt:'#a69ab7',pants:'#868292',accent:'#b6a8c3'}};
 const line=(points,color,width=12)=>`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
 function draw(kind='sitstand',palette='sage'){
  const c=palettes[palette]||palettes.sage,skin='#ddbea2',hair='#dad8cd',shoe='#6b7167';
  let props='',person='',arrow='';
  const chair=(x=115,y=135)=>`<path d="M${x} 99v${y-99}h49m-45 0-4 55m46-55 7 55" fill="none" stroke="#a9ac99" stroke-width="5" stroke-linecap="round"/><path d="M${x-3} 98h9v34h-9z" fill="#c6c8b3"/><rect x="${x-3}" y="${y-2}" width="57" height="7" rx="3" fill="#bfc3aa"/>`;
  const head=(x,y,side=true)=>`<path d="M${x-1} ${y+11}v10" stroke="${skin}" stroke-width="10"/><ellipse cx="${x}" cy="${y}" rx="12" ry="15" fill="${skin}"/><path d="M${x-12} ${y+2}q-5-22 12-21q17-1 13 15l-8-2-6-7-2 12z" fill="${hair}"/><path d="M${x-12} ${y-4}q-8-4-8 3q0 7 8 5" fill="${hair}"/><circle cx="${x+(side?8:4)}" cy="${y+1}" r="1.1" fill="#7c796e"/><path d="M${x+7} ${y+8}h4" stroke="#b28e77" stroke-width="1"/>`;
  const seated=['knee','arms','ball','band','seatedmarch','ankle','hands'].includes(kind);
  if(seated){
   props=chair(124,140);
   let hx=151,hy=60;
   person=head(hx,hy)+`<path d="M143 80q11-6 21 2l4 51q-12 12-29 4l-3-38z" fill="${c.shirt}"/>`;
   let near='149,139 183,142 190,184',far='145,139 171,147 170,183';
   if(kind==='knee')near='151,139 187,141 226,127';
   if(kind==='seatedmarch')near='151,139 182,124 201,157';
   if(kind==='ankle')near='151,139 184,143 192,180';
   person+=line(far,c.pants,13)+line(near,c.pants,15);
   person+=line('168,186 182,186',shoe,7);
   person+=kind==='knee'?line('226,127 239,125',shoe,7):kind==='seatedmarch'?line('201,157 211,156',shoe,7):line('191,185 207,185',shoe,7);
   let arms='148,87 173,115 194,113';
   if(kind==='arms')arms='149,88 176,64 190,37';
   if(kind==='ball')arms='148,87 170,111 192,96';
   if(kind==='band')arms='147,87 177,103 197,89';
   if(kind==='hands')arms='147,87 168,114 193,111';
   person+=line(arms,c.shirt,11);
   const end=arms.split(' ').pop();person+=`<circle cx="${end.split(',')[0]}" cy="${end.split(',')[1]}" r="6" fill="${skin}"/>`;
   if(kind==='ball')props+=`<circle cx="211" cy="94" r="23" fill="#c0b4c9"/><path d="M193 80q20 10 34 4M195 110q11-14 8-36" fill="none" stroke="#a59aaf" stroke-width="1.5"/>`;
   if(kind==='band')props+=`<path d="M171 102 213 80" stroke="#bf976a" stroke-width="4"/><path d="M163 88 181 109 210 84" fill="none" stroke="${c.shirt}" stroke-width="9" stroke-linecap="round"/><circle cx="210" cy="84" r="5" fill="${skin}"/>`;
   if(kind==='hands')props+=`<path d="M191 105q10-6 21 1l-2 14-20-3z" fill="#c8b3a1"/>`;
   if(kind==='knee')arrow='<path d="M213 160q19-5 29-20m-8 1 9-3-1 9"/>';
   if(kind==='arms')arrow='<path d="M210 79q16-17 10-38m-5 8 4-10 6 7"/>';
   if(kind==='ankle')arrow='<path d="M220 184q8-12-2-24m0 8-2-10 9 4"/>';
   if(kind==='seatedmarch')arrow='<path d="M219 145v-27m-5 6 5-8 5 8"/>';
  } else if(kind==='lying'){
   props='<rect x="70" y="144" width="208" height="11" rx="5" fill="#bdc6ad"/><path d="M83 154v34m182-34v34" stroke="#a1ae92" stroke-width="5"/><rect x="80" y="127" width="38" height="17" rx="8" fill="#e6e4d5"/>';
   person=`<ellipse cx="107" cy="120" rx="15" ry="12" fill="${skin}"/><path d="M101 109q-17-1-11 17l8 1z" fill="${hair}"/><path d="M122 124h58" stroke="${c.shirt}" stroke-width="25" stroke-linecap="round"/>`+line('179,126 215,107 242,137',c.pants,14)+line('128,118 152,110 173,117',skin,8)+line('242,138 255,139',shoe,7);arrow='<path d="M148 83v-20m-5 6 5-8 5 8"/>';
  }else{
   let hx=160,hy=44,torso='M153 64q13-5 23 5l-2 52q-14 9-28-1l-1-31z',legsA='152,119 151,153 144,186',legsB='167,119 173,154 179,186',arms='168,73 187,99 211,96';
   if(kind==='sitstand'){props=chair(105,143);hx=166;hy=46;torso='M157 67q12-5 23 6l-8 50q-13 9-26-2l4-32z';legsA='153,121 178,145 162,185';legsB='165,121 192,147 179,185';arms='171,78 196,101 211,95';arrow='<path d="M215 79V48m-5 8 5-10 5 10"/>';}
   if(kind==='squat'){hx=164;hy=66;torso='M155 86q14-6 23 5l-8 42q-16 7-28-3l6-29z';legsA='149,132 178,153 153,185';legsB='162,132 192,153 178,185';arms='170,92 198,108 222,96';}
   if(kind==='march'){legsB='167,120 203,126 203,161';arrow='<path d="M224 150v-27m-5 6 5-8 5 8"/>';}
   if(kind==='step'){legsB='167,119 203,136 207,163';legsA='152,119 155,151 151,185';props='<path d="M190 191v-25h55v25" fill="#d1c5d9" stroke="#b9adc4" stroke-width="2"/>';arms='168,73 193,96 224,93';}
   if(kind==='walking'){legsA='152,119 137,150 118,181';legsB='167,119 188,151 208,183';arms='168,73 189,104 208,103';props='<path d="m84 190 8-21 9 21zM240 186l7-20 9 20z" fill="#c9b083"/><path d="M80 191h25m131-4h25" stroke="#b99c6b" stroke-width="3"/>';}
   if(kind==='shift'){legsA='152,119 138,154 130,185';legsB='167,119 188,155 200,185';arrow='<path d="M131 156h-28m7-5-9 5 9 5M205 156h28m-7-5 9 5-9 5"/>';}
   if(kind==='tandem'){legsA='152,119 162,151 158,182';legsB='167,119 171,153 180,188';}
   if(kind==='heels'){legsA='152,119 151,150 149,178';legsB='167,119 173,150 179,178';arrow='<path d="M129 182v-19m-4 5 4-7 4 7"/>';}
   person=head(hx,hy)+`<path d="${torso}" fill="${c.shirt}"/>`+line(legsA,c.pants,14)+line(legsB,c.pants,15)+line(arms,c.shirt,11);
   const end=arms.split(' ').pop();person+=`<circle cx="${end.split(',')[0]}" cy="${end.split(',')[1]}" r="6" fill="${skin}"/>`;
   for(const leg of [legsA,legsB]){const [x,y]=leg.split(' ').pop().split(',').map(Number);person+=line(`${x-2},${y+3} ${x+12},${y+3}`,shoe,7);}
   if(['march','heels','shift','squat','step','tandem'].includes(kind))props+=`<path d="M211 98h45m-37 0v92m29-92v92" fill="none" stroke="#b1b9a4" stroke-width="4" stroke-linecap="round"/>`;
  }
  return `<svg class="exercise-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 220" aria-hidden="true"><rect width="340" height="220" fill="${c.bg}"/><circle cx="175" cy="114" r="85" fill="${c.circle}" opacity=".67"/><circle cx="250" cy="47" r="3" fill="${c.accent}" opacity=".3"/><circle cx="82" cy="89" r="2" fill="${c.accent}" opacity=".3"/><path d="M54 195h234" stroke="${c.accent}" stroke-width="1" opacity=".45"/><ellipse cx="174" cy="195" rx="77" ry="5" fill="${c.accent}" opacity=".13"/><path d="M283 193v-28m0 14q-15-2-13-15 13 0 13 15m0-5q14-4 14-17-14 3-14 17" stroke="${c.accent}" fill="none" stroke-width="1.5" opacity=".6"/>${props}${person}<g stroke="${c.accent}" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${arrow}</g></svg>`;
 }
 return {draw,palettes};
})();
