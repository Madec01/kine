(() => {
'use strict';
const M=window.KineModel, A=window.KineArt, KEY='kine-library-v1';
const $=selector=>document.querySelector(selector), $$=selector=>[...document.querySelectorAll(selector)];
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icons={
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
 folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',x:'<path d="m6 6 12 12M18 6 6 18"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 sliders:'<path d="M4 6h9m4 0h3M4 12h3m4 0h9M4 18h10m4 0h2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
 arrow:'<path d="M4 12h15m-5-5 5 5-5 5"/>',back:'<path d="M20 12H5m5-5-5 5 5 5"/>',
 book:'<path d="M12 5C8 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-5-1-9 1Zm0 0v15"/>',
 tag:'<path d="m12 3 9 9-9 9-9-9V3Z"/><circle cx="7.5" cy="7.5" r="1"/>',
 archive:'<rect x="3" y="3" width="18" height="4" rx="1"/><path d="M5 7v14h14V7M9 11h6"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
 sprout:'<path d="M12 21V11M12 14C4 15 3 9 3 6c5 0 9 2 9 8Zm0-3C12 5 16 3 21 3c0 5-3 8-9 8Z"/>',
 leaf:'<path d="M20 3c1 12-3 18-10 16C2 17 3 7 11 6c4 0 7-1 9-3ZM4 21 15 10"/>',
 sparkles:'<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3ZM20 2v4m-2-2h4"/>',
 list:'<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 person:'<circle cx="12" cy="5" r="2.5"/><path d="M5 11h14m-7-3v7m0 0-4 7m4-7 4 7"/>',
 strength:'<path d="m3 8 5-5m8 18 5-5M6 11l5-5m2 12 5-5M5 5l14 14"/>',
 balance:'<path d="M12 3v17M6 20h12M3 7h18M6 7l-4 7h8L6 7Zm12 0-4 7h8l-4-7Z"/>',
 mobility:'<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
 walk:'<circle cx="14" cy="4" r="2"/><path d="m7 10 5-3 3 4 4 1m-7-5-2 8-4 6m4-6 5 2v5"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 activity:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',
 stethoscope:'<path d="M4 3v6a5 5 0 0 0 10 0V3M2 3h4m6 0h4M9 14v2a5 5 0 0 0 10 0v-3"/><circle cx="19" cy="10" r="3"/>',
 edit:'<path d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z"/>',
 print:'<path d="M6 9V3h12v6M6 18H3V9h18v9h-3M6 14h12v7H6Z"/><path d="M17 11h1"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
 trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 check:'<path d="m5 12 4 4L20 5"/>',alert:'<path d="m12 3 10 18H2Zm0 6v5m0 3v.1"/>',
 chevron:'<path d="m9 5 7 7-7 7"/>',link:'<path d="m10 13 4-4M8 16l-2 2a4 4 0 0 1-5-5l5-5a4 4 0 0 1 5 0m2 8a4 4 0 0 0 5 0l5-5a4 4 0 0 0-5-5l-2 2"/>'
};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.target}</svg>`;
function hydrate(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);el.removeAttribute('data-icon');});}
let state=M.validateState(M.clone(window.KINE_SEED)), storageProblem='',blockedStorage=false;
try{const saved=localStorage.getItem(KEY);if(saved)state=M.validateState(JSON.parse(saved));}catch(error){storageProblem='La sauvegarde locale ne peut pas être lue. Exportez-la depuis « Sauvegarde & données » avant de la remplacer.';blockedStorage=true;}
let view='library',collectionId=null,query='',filters={},sort='default',listMode=false,detailId=null,editorCategories=[],editorId=null,pendingMedia=null,utilityMode=null,toastTimer;
const phoneMedia=window.matchMedia('(max-width: 840px), (max-width: 1000px) and (pointer: coarse)');
const viewMemory=new Map();
let draftFilters=null,modalHistory=false,historyClosing=false;
const newId=prefix=>`${prefix}-${typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}`;
const category=id=>state.categories.find(c=>c.id===id);
const exercise=id=>state.exercises.find(e=>e.id===id);
function toast(message){const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},5500);}
function save(next,message){
 try{if(blockedStorage)throw new Error('Sauvegarde locale illisible : utilisez l’import de sauvegarde pour la remplacer explicitement.');const checked=M.validateState(next);localStorage.setItem(KEY,JSON.stringify(checked));state=checked;render();if(message)toast(message);return true;}
 catch(error){toast(error.name==='QuotaExceededError'?'Stockage plein. Exportez vos données et réduisez la taille des images.':`Enregistrement impossible : ${error.message}`);return false;}
}
function change(mutator,message){const next=M.clone(state);mutator(next);return save(next,message);}
function syncModalHistory(){
 const open=$('dialog[open]');
 if(open&&!modalHistory&&!historyClosing){history.pushState({...(history.state||{}),kineOverlay:true},'');modalHistory=true;}
 else if(!open&&modalHistory&&!historyClosing){historyClosing=true;history.back();}
}
function showDialog(id){const el=$(id);if(!el.open){el.showModal();syncModalHistory();}}
function closeDialog(id){$(id).close();queueMicrotask(syncModalHistory);}
function closeButton(dialog){return `<button type="button" class="icon-button dialog-close" data-action="close" data-dialog="${dialog}" aria-label="Fermer"><span class="close-icon">${icon('x')}</span><span class="back-icon">${icon('back')}</span></button>`;}
function heading(title,description='',dialog='utility-dialog'){return `<div class="dialog-header"><div><h2 id="${dialog==='editor-dialog'?'editor':dialog==='detail-dialog'?'detail':'utility'}-title">${escape(title)}</h2>${description?`<p>${escape(description)}</p>`:''}</div>${closeButton(dialog)}</div>`;}
function utility(title,description,body,mode){utilityMode=mode;$('#utility-content').innerHTML=heading(title,description)+`<div class="utility-body">${body}</div>`;showDialog('#utility-dialog');}
function toggleFilter(key,value){
 const active=document.activeElement,container=active.closest('#quick-filters,#active-filters,#filter-fields')?.id;
 const values=filters[key]||[];filters[key]=values.includes(value)?values.filter(v=>v!==value):[...values,value];
 renderControls();render();
 if(container){const target=container==='filter-fields'?`#filter-fields input[data-filter="${CSS.escape(key)}"][value="${CSS.escape(value)}"]`:`#${container} [data-key="${CSS.escape(key)}"][data-value="${CSS.escape(value)}"]`;$(target)?.focus({preventScroll:true});}
}
function resetFilters(){filters={};query='';$('#search').value='';renderControls();render();}
function go(next,id=null){
 if(next===view&&id===collectionId){window.scrollTo({top:0,behavior:'instant'});return;}
 viewMemory.set(view+(collectionId||''),{query,filters:M.clone(filters),sort,listMode,scrollY:window.scrollY});
 view=next;collectionId=id;
 const saved=viewMemory.get(next+(id||''));
 query=saved?.query||'';filters=M.clone(saved?.filters||{});sort=saved?.sort||'default';listMode=saved?.listMode||false;
 $('#search').value=query;$('#sort').value=sort;renderControls();render();
 requestAnimationFrame(()=>window.scrollTo({top:saved?.scrollY||0,behavior:'instant'}));
}
function openMobileFilters(){
 draftFilters=M.clone(filters);
 $('#mobile-filter-fields').innerHTML=state.categories.map((c,index)=>`<details class="mobile-filter-group" data-mobile-category="${c.id}" ${index<2||(draftFilters[c.id]||[]).length?'open':''}><summary><span>${escape(c.name)}</span><span class="filter-group-count"></span>${icon('chevron')}</summary><fieldset><legend class="sr-only">${escape(c.name)}</legend><div class="check-options">${c.tags.map(tag=>`<label class="check-chip"><input type="checkbox" data-mobile-filter="${c.id}" value="${escape(tag)}" ${(draftFilters[c.id]||[]).includes(tag)?'checked':''}>${escape(tag)}</label>`).join('')||'<p>Aucun tag dans cette catégorie.</p>'}</div></fieldset></details>`).join('');
 updateFilterPreview();showDialog('#filters-dialog');$('#toggle-filters').setAttribute('aria-expanded','true');
}
function updateFilterPreview(){
 if(!draftFilters)return;
 const count=M.selectExercises(state,{view,collectionId,query,filters:draftFilters,sort}).length;
 $('#mobile-filter-apply').textContent=`Afficher ${count} exercice${count>1?'s':''}`;
 $$('#mobile-filter-fields .mobile-filter-group').forEach(group=>{const selected=(draftFilters[group.dataset.mobileCategory]||[]).length;group.querySelector('.filter-group-count').textContent=selected?String(selected):'';});
}
function applyMobileFilters(){if(!draftFilters)return;filters=M.clone(draftFilters);renderControls();render();closeDialog('#filters-dialog');}
function renderControls(){
 const quickScroll=$('#quick-filters').scrollLeft;
 const goalIcons={'Renforcement':'strength','Équilibre':'balance','Mobilité':'mobility','Marche':'walk','Coordination':'target','Endurance':'activity','Respiration':'leaf'};
 $('#quick-filters').innerHTML=`<button class="chip ${!(filters.goal||[]).length?'active':''}" data-action="all-goals" aria-pressed="${!(filters.goal||[]).length}">${icon('grid')} Tous les objectifs</button>`+category('goal').tags.map(tag=>`<button class="chip ${(filters.goal||[]).includes(tag)?'active':''}" data-action="filter" data-key="goal" data-value="${escape(tag)}" aria-pressed="${(filters.goal||[]).includes(tag)}">${icon(goalIcons[tag]||'target')}${escape(tag)}</button>`).join('');
 $('#filter-fields').innerHTML=state.categories.map(c=>`<fieldset><legend>${escape(c.name)}</legend><div class="check-options">${c.tags.map(tag=>`<label class="check-chip"><input type="checkbox" data-filter="${c.id}" value="${escape(tag)}" ${(filters[c.id]||[]).includes(tag)?'checked':''}>${escape(tag)}</label>`).join('')||'<span class="collection-empty">Ajoutez des tags dans Catégories & tags.</span>'}</div></fieldset>`).join('');
 $('#active-filters').innerHTML=Object.entries(filters).flatMap(([key,values])=>values.map(value=>`<button class="active-filter" data-action="filter" data-key="${key}" data-value="${escape(value)}" aria-label="Retirer le filtre ${escape(value)}">${escape(value)}${icon('x')}</button>`)).join('');
 const count=Object.values(filters).flat().length;$('#filter-count').textContent=count;$('#filter-count').hidden=!count;
 $('#quick-filters').scrollLeft=quickScroll;$('#toggle-filters').setAttribute('aria-controls',phoneMedia.matches?'filters-dialog':'filter-panel');
}
function imageMarkup(e,detail=false){
 if(e.media.type==='image')return `<img src="${escape(e.media.src)}" alt="${escape(e.name)}" loading="lazy" referrerpolicy="no-referrer">`;
 if(e.media.type==='video'&&detail)return `<video controls preload="metadata" src="${escape(e.media.src)}" aria-label="Vidéo : ${escape(e.name)}">Votre navigateur ne prend pas en charge cette vidéo.</video>`;
 return A.draw(e.art,e.palette);
}
function favoriteButton(e){const favorite=state.favorites.includes(e.id);return `<button class="favorite-button" data-action="favorite" data-id="${e.id}" aria-label="${favorite?'Retirer des':'Ajouter aux'} favoris : ${escape(e.name)}" aria-pressed="${favorite}">${icon('heart')}</button>`;}
function card(e){
 const level=e.tags.level[0]||'Niveau à préciser',levelIndex=category('level').tags.indexOf(level);
 return `<article class="exercise-card" aria-labelledby="card-title-${e.id}"><button class="card-main" data-action="detail" data-id="${e.id}" aria-label="Ouvrir la fiche : ${escape(e.name)}"><span class="card-visual">${imageMarkup(e)}${e.media.type==='illustration'?'<span class="art-note">Illustration schématique</span>':''}</span><span class="card-content"><span class="level-badge ${levelIndex===1?'moderate':levelIndex>=2?'advanced':''}"><span class="level-dot"></span>${escape(level)}</span><span class="card-title" id="card-title-${e.id}">${escape(e.name)}</span><span class="card-subtitle">${escape(e.subtitle||e.objective)}</span><span class="card-tags">${e.tags.goal.slice(0,2).map(t=>`<span class="tag">${escape(t)}</span>`).join('')}${e.tags.equipment.slice(0,2).map(t=>`<span class="tag equipment">${escape(t)}</span>`).join('')}</span><span class="card-footer"><span>${icon('person')}${escape(e.tags.position.join(' · ')||'À préciser')}</span><span class="card-open">Voir la fiche ${icon('arrow')}</span></span></span></button>${favoriteButton(e)}</article>`;
}
function render(){
 $('#all-count').textContent=state.exercises.length;$('#fav-count').textContent=state.favorites.length;$('#collection-count').textContent=state.collections.length;
 $('#stat-all').textContent=state.exercises.length;$('#stat-favorites').textContent=state.favorites.length;$('#stat-collections').textContent=state.collections.length;
 $$('[data-view]').forEach(button=>{const active=button.dataset.view===view||(view==='collection'&&button.dataset.view==='collections');button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
 const currentCollection=state.collections.find(c=>c.id===collectionId);
 if(view==='collection'&&!currentCollection){view='collections';collectionId=null;}
 const titles={settings:'Mon espace',library:'Votre bibliothèque d’exercices',favorites:'Vos exercices favoris',collections:'Vos collections personnelles',collection:currentCollection?.name};
 const descriptions={settings:'Votre bibliothèque, à votre façon.',library:'Le bon mouvement, pour chaque patient. Retrouvez vos exercices en un instant.',favorites:'Vos essentiels, toujours à portée de main.',collections:'Rassemblez vos exercices par thème, objectif ou contexte de soin.',collection:currentCollection?.description||'Une sélection d’exercices pour votre pratique.'};
 const labels={settings:'Mon espace',library:'Bibliothèque',favorites:'Mes favoris',collections:'Mes collections',collection:currentCollection?.name};
 const mobileTitles={library:'Vos exercices',favorites:'Vos favoris',collections:'Vos collections'};
 $('#page-title').innerHTML=`${escape(phoneMedia.matches?(mobileTitles[view]||titles[view]):titles[view])}<span>.</span>`;$('#page-description').textContent=phoneMedia.matches&&view==='library'?'Le bon mouvement, pour chaque patient.':descriptions[view];$('#breadcrumb-current').textContent=labels[view];
 $('#add-exercise').innerHTML=icon('plus')+(view==='collections'?'Créer une collection':'Ajouter un exercice');
 const collectionView=view==='collections',settingsView=view==='settings';
 $('#library-controls').hidden=collectionView||settingsView;$('.results-options').hidden=collectionView||settingsView;$('#exercise-grid').hidden=collectionView||settingsView;$('#collections-grid').hidden=!collectionView;
 $('#settings-view').hidden=!settingsView;$('.results-toolbar').hidden=settingsView;$('#add-exercise').hidden=settingsView;$('#mobile-add').hidden=settingsView;
 $('#mobile-add').innerHTML=icon('plus')+`<span>${collectionView?'Collection':'Exercice'}</span>`;
 $('#mobile-fav-count').textContent=state.favorites.length;$('#mobile-fav-count').hidden=!state.favorites.length;
 $('#clear-search').hidden=!query;
 $('#grid-view').classList.toggle('selected',!listMode);$('#grid-view').setAttribute('aria-pressed',String(!listMode));$('#list-view').classList.toggle('selected',listMode);$('#list-view').setAttribute('aria-pressed',String(listMode));
 if(settingsView){$('#collection-bar').hidden=true;$('#empty-state').hidden=true;return;}
 $('#section-title').textContent={library:'Tous les exercices',favorites:'Mes favoris',collections:'Mes collections',collection:'Exercices de la collection'}[view];
 $('#collection-bar').hidden=view!=='collection';
 if(view==='collection')$('#collection-bar').innerHTML=`<button class="text-button" data-action="back-collections">← Toutes les collections</button><div><button class="button" data-action="select-collection-exercises" data-id="${collectionId}">${icon('plus')} Gérer les exercices</button> <button class="button" data-action="export-collection" data-id="${collectionId}">${icon('download')} Exporter</button></div>`;
 let count;
 if(collectionView){
 count=state.collections.length;$('#collections-grid').innerHTML=state.collections.map(c=>`<article class="collection-card">${icon('folder')}<button class="icon-button" data-action="edit-collection" data-id="${c.id}" aria-label="Modifier ${escape(c.name)}">${icon('edit')}</button><h3>${escape(c.name)}</h3><p>${escape(c.description||'Votre sélection personnelle')}<br>${c.exerciseIds.length} exercice${c.exerciseIds.length>1?'s':''}</p><button class="button" data-action="open-collection" data-id="${c.id}">Explorer la collection ${icon('arrow')}</button></article>`).join('');
 }else{const items=M.selectExercises(state,{view,collectionId,query,filters,sort});count=items.length;$('#exercise-grid').innerHTML=items.map(card).join('');$('#exercise-grid').classList.toggle('list-mode',listMode);}
 $('#result-count').textContent=`${count}${collectionView?'':` exercice${count>1?'s':''}`}`;
 const empty=$('#empty-state');empty.hidden=count>0;
 if(!count){let title='Aucun exercice ne correspond',description='Essayez un autre mot ou retirez quelques filtres.',action='reset',label='Réinitialiser la recherche',symbol='search';if(collectionView){title='Une place pour vos idées';description='Créez une collection pour rassembler les exercices qui vont ensemble.';action='new-collection';label='Créer ma première collection';symbol='folder';}else if(view==='favorites'&&!state.favorites.length){title='Gardez vos essentiels près de vous';description='Touchez le cœur d’un exercice pour le retrouver ici.';action='library';label='Explorer la bibliothèque';symbol='heart';}else if(view==='collection'&&!currentCollection?.exerciseIds.length){title='Votre collection attend ses exercices';description='Choisissez les exercices à réunir dans cette collection.';action='select-collection-exercises';label='Ajouter des exercices';symbol='folder';}empty.innerHTML=`${icon(symbol)}<h3>${title}</h3><p>${description}</p><button class="button primary" data-action="${action}" data-id="${collectionId||''}">${label}</button>`;}
}
function toggleFavorite(id){
 if(!exercise(id))return;const exists=state.favorites.includes(id),focused=document.activeElement?.matches('.favorite-button');
 if(change(next=>{next.favorites=exists?next.favorites.filter(key=>key!==id):[...next.favorites,id];},exists?'Exercice retiré des favoris.':'Exercice ajouté aux favoris.')){
 const btn=$('#detail-dialog [data-action="favorite-detail"]');
 if(btn){btn.innerHTML=icon('heart')+`<span>${exists?'Ajouter aux favoris':'Dans mes favoris'}</span>`;btn.setAttribute('aria-pressed',String(!exists));btn.setAttribute('aria-label',exists?'Ajouter aux favoris':'Retirer des favoris');}
 if(focused)($(`.favorite-button[data-id="${id}"]`)||$('.favorite-button')||$('#main')).focus({preventScroll:true});
 }
}
function detailSection(title,content,symbol='target',className='',id=''){return `<section class="detail-section ${className}" ${id?`id="${id}" tabindex="-1"`:''}><h3>${icon(symbol)}${title}</h3>${content}</section>`;}
function openDetail(id){
 const e=exercise(id);if(!e)return;detailId=id;
 const dosageLabels={sets:'Séries',reps:'Répétitions',duration:'Durée',rest:'Récupération',intensity:'Intensité'};
 const dosage=`<dl class="dosage-grid">${Object.entries(dosageLabels).map(([key,label])=>`<div><dt>${label}</dt><dd>${escape(e.dosage[key]||'À adapter')}</dd></div>`).join('')}</dl>`;
 const related=e.related.map(key=>exercise(key)).filter(Boolean);
 const others=state.categories.filter(c=>!['goal','level','equipment','position','muscles','capacity'].includes(c.id)&&e.tags[c.id]?.length);
 $('#detail-content').innerHTML=heading(e.name,e.subtitle,'detail-dialog')+`<nav class="detail-shortcuts" aria-label="Accès rapide dans la fiche"><button data-action="detail-jump" data-target="detail-start">Consignes</button><button data-action="detail-jump" data-target="detail-dosage">Dosage</button><button data-action="detail-jump" data-target="detail-precautions">Vigilance</button></nav><div class="detail-body"><div class="detail-top"><div class="detail-art">${imageMarkup(e,true)}${e.media.type==='illustration'?'<span class="art-note">Illustration schématique — se référer aux consignes</span>':''}</div><div class="detail-lead"><h3>Objectif principal</h3><p>${escape(e.objective||'À renseigner')}</p><div class="detail-tags">${[...e.tags.goal,...e.tags.level].map(t=>`<span class="tag">${escape(t)}</span>`).join('')}</div><div class="dosage-box" id="detail-dosage" tabindex="-1"><h3>Dosage · repères à individualiser</h3>${dosage}</div></div></div><div class="detail-sections">`+
 detailSection('Position de départ',`<p>${escape(e.start||'À renseigner')}</p><div class="detail-tags">${e.tags.position.map(t=>`<span class="tag">${escape(t)}</span>`).join('')}</div>`,'person','','detail-start')+
 detailSection('Objectifs secondaires',`<p>${escape(e.secondary||'Non renseignés')}</p>`,'target')+
 detailSection('Réalisation',`<ol>${e.steps.map(step=>`<li>${escape(step)}</li>`).join('')||'<li>Consignes à renseigner.</li>'}</ol>`,'list','wide')+
 detailSection('Groupes musculaires',`<p>${escape(e.tags.muscles.join(' · ')||'À renseigner')}</p>`,'strength')+
 detailSection('Capacités motrices',`<p>${escape(e.tags.capacity.join(' · ')||'À renseigner')}</p>`,'activity')+
 detailSection('Matériel',`<p><strong>Indispensable :</strong> ${escape(e.tags.equipment.join(', ')||'À préciser')}<br><strong>Facultatif :</strong> ${escape(e.optional||'Aucun renseigné')}</p>`,'archive')+
 detailSection('Critères de réussite',`<p>${escape(e.success||'À renseigner')}</p>`,'check')+
 detailSection('Précautions & points de vigilance',`<p>${escape(e.precautions||'À renseigner selon l’évaluation clinique.')}</p>`,'alert','wide precautions','detail-precautions')+
 detailSection('Pour simplifier',`<p>${escape(e.easier||'À renseigner')}</p>`,'leaf')+
 detailSection('Pour progresser',`<p>${escape(e.harder||'À renseigner')}</p>`,'activity')+
 (related.length?detailSection('Exercices & progressions liés',related.map(item=>`<button class="button variant-link" data-action="detail" data-id="${item.id}">${escape(item.name)} ${icon('arrow')}</button>`).join(''),'link','wide'):'')+
 others.map(c=>detailSection(escape(c.name),`<p>${escape(e.tags[c.id].join(' · '))}</p>`,'tag')).join('')+
 detailSection('Commentaires personnels',`<p>${escape(e.comments||'Aucun commentaire. Utilisez « Modifier » pour ajouter vos observations sur l’exercice.')}</p>`,'edit','wide')+
 `</div><p class="clinical-note">Ces repères ne constituent pas une prescription. Le choix de l’exercice, l’assistance et le dosage reposent sur votre évaluation clinique. Les illustrations sont schématiques.</p></div><div class="detail-actions"><button class="button" data-action="favorite-detail" data-id="${id}" aria-pressed="${state.favorites.includes(id)}" aria-label="${state.favorites.includes(id)?'Retirer des favoris':'Ajouter aux favoris'}">${icon('heart')}<span>${state.favorites.includes(id)?'Dans mes favoris':'Ajouter aux favoris'}</span></button><button class="button" data-action="add-to-collection" data-id="${id}">${icon('folder')} Collection</button><button class="button" data-action="print" data-id="${id}">${icon('print')} Imprimer</button><button class="button primary push-right" data-action="edit" data-id="${id}">${icon('edit')} Modifier</button><button class="button mobile-detail-more" data-action="detail-menu" data-id="${id}" aria-label="Autres actions sur la fiche">${icon('more')}</button></div>`;
 showDialog('#detail-dialog');$('#detail-dialog').scrollTop=0;$('#detail-dialog .detail-body').scrollTop=0;
}
function field(name,label,value='',options={}){
 const control=options.textarea?`<textarea name="${name}" rows="${options.rows||3}" ${options.required?'required':''} maxlength="20000">${escape(value)}</textarea>`:`<input name="${name}" value="${escape(value)}" ${options.required?'required':''} maxlength="${options.max||300}" ${options.placeholder?`placeholder="${escape(options.placeholder)}"`:''}>`;
 return `<label class="form-field ${options.full?'full':''}"><span>${label}${options.required?' *':''}</span>${control}${options.help?`<small>${escape(options.help)}</small>`:''}</label>`;
}
function editorTagGroup(c,selected=[]){return `<fieldset class="form-tags" data-category-group="${c.id}"><legend>${escape(c.name)}</legend><div class="check-options">${c.tags.map(t=>`<label class="check-chip"><input type="${c.id==='level'?'radio':'checkbox'}" name="tag:${c.id}" value="${escape(t)}" ${selected.includes(t)?'checked':''}>${escape(t)}</label>`).join('')}</div><div class="form-tag-input"><input type="text" maxlength="120" data-new-tag="${c.id}" placeholder="Ajouter un tag…" aria-label="Nouveau tag : ${escape(c.name)}"><button type="button" data-action="editor-add-tag" data-key="${c.id}" aria-label="Ajouter le tag à ${escape(c.name)}">+</button></div></fieldset>`;}
function openEditor(id=null){
 const e=id?exercise(id):null;if(id&&!e)return;editorId=id;editorCategories=M.clone(state.categories);pendingMedia=e?.media||{type:'illustration',src:''};
 const names={sitstand:'Assis-debout',knee:'Extension du genou',tandem:'Équilibre debout',arms:'Élévation des bras',march:'Marche avec appui',ball:'Ballon assis',heels:'Relevé de talons',band:'Élastique assis',shift:'Transfert latéral',seatedmarch:'Marche assise',squat:'Flexions debout',step:'Marche basse',ankle:'Cheville assis',hands:'Préhension',lying:'Allongé',walking:'Parcours de marche'};
 $('#exercise-form').innerHTML=heading(e?'Modifier l’exercice':'Un nouvel exercice','Une fiche claire, adaptée à votre pratique. Les champs * sont obligatoires.','editor-dialog')+`<div class="form-body">`+
 field('name','Nom de l’exercice',e?.name,{required:true,full:true,max:180})+
 field('subtitle','Description courte',e?.subtitle,{full:true,max:300,placeholder:'Une phrase pour retrouver l’intention de l’exercice'})+
 field('objective','Objectif principal',e?.objective,{required:true,textarea:true})+
 field('secondary','Objectifs secondaires',e?.secondary,{textarea:true})+
 '<div class="form-divider">Classer l’exercice</div>'+editorCategories.map(c=>`<details class="editor-tag-section" ${!phoneMedia.matches||['goal','level','equipment','position'].includes(c.id)?'open':''}><summary>${escape(c.name)}${icon('chevron')}</summary>${editorTagGroup(c,e?.tags[c.id]||[])}</details>`).join('')+
 '<div class="form-divider">Position & réalisation</div>'+
 field('start','Position de départ',e?.start,{textarea:true,full:true})+
 field('steps','Consignes de réalisation',e?.steps?.join('\n'),{textarea:true,rows:4,full:true,help:'Une étape par ligne.'})+
 '<div class="form-divider">Dosage indicatif · à individualiser</div>'+
 field('sets','Séries',e?.dosage.sets,{placeholder:'Ex. : 1 à 2'})+field('reps','Répétitions',e?.dosage.reps,{placeholder:'Ex. : 5 à 8 / côté'})+field('duration','Durée',e?.dosage.duration,{placeholder:'Ex. : 20 à 30 s'})+field('rest','Récupération',e?.dosage.rest,{placeholder:'Ex. : 60 s'})+field('intensity','Intensité',e?.dosage.intensity,{full:true,placeholder:'Ex. : effort léger, selon tolérance'})+
 '<div class="form-divider">Adapter & observer</div>'+
 field('optional','Matériel facultatif',e?.optional,{textarea:true})+field('success','Critères de réussite',e?.success,{textarea:true})+field('precautions','Précautions & points de vigilance',e?.precautions,{textarea:true,full:true})+field('easier','Variante plus facile',e?.easier,{textarea:true})+field('harder','Variante plus difficile',e?.harder,{textarea:true})+
 `<fieldset class="form-field full form-tags"><legend>Exercices & progressions liés</legend><div class="check-options">${state.exercises.filter(item=>item.id!==id).map(item=>`<label class="check-chip"><input type="checkbox" name="related" value="${item.id}" ${e?.related.includes(item.id)?'checked':''}>${escape(item.name)}</label>`).join('')}</div><small>Les liens seront visibles dans les deux fiches.</small></fieldset>`+
 field('comments','Commentaires personnels',e?.comments,{textarea:true,full:true,help:'Notes sur l’exercice uniquement ; cet outil n’est pas un dossier patient.'})+
 '<div class="form-divider">Illustration & médias</div>'+
 `<label class="form-field"><span>Type de média</span><select name="mediaType" id="media-type"><option value="illustration" ${pendingMedia.type==='illustration'?'selected':''}>Illustration de la bibliothèque</option><option value="image" ${pendingMedia.type==='image'?'selected':''}>Photo ou image</option><option value="video" ${pendingMedia.type==='video'?'selected':''}>Vidéo (adresse HTTPS directe)</option></select></label><label class="form-field"><span>Illustration schématique</span><select name="art">${Object.entries(names).map(([key,label])=>`<option value="${key}" ${(e?.art||'sitstand')===key?'selected':''}>${label}</option>`).join('')}</select></label><label class="form-field"><span>Couleur de la vignette</span><select name="palette">${Object.entries({sage:'Sauge',sand:'Sable',blue:'Bleu',rose:'Terracotta',lavender:'Lavande'}).map(([key,label])=>`<option value="${key}" ${(e?.palette||'sage')===key?'selected':''}>${label}</option>`).join('')}</select></label>`+
 field('mediaUrl','Adresse HTTPS de l’image ou de la vidéo',pendingMedia.src.startsWith('https:')?pendingMedia.src:'',{max:2000,help:'Pour une vidéo : lien direct vers un fichier lisible par le navigateur (ex. MP4). Pas un lien de page YouTube.'})+
 `<label class="form-field full"><span>Ou importer une image (PNG, JPEG, WebP, GIF · 1 Mo maximum)</span><input type="file" id="media-file" accept="image/png,image/jpeg,image/webp,image/gif"><small id="media-status">${pendingMedia.src.startsWith('data:')?'Image importée actuellement conservée.':'Les images importées sont incluses dans vos sauvegardes.'}</small></label><p class="form-error" id="editor-error" role="alert" hidden></p></div><div class="form-actions">${e?`<button type="button" class="button danger" data-action="delete-exercise" data-id="${e.id}" style="margin-right:auto">${icon('trash')} Supprimer</button>`:''}<button type="button" class="button" data-action="close" data-dialog="editor-dialog">Annuler</button><button type="submit" class="button primary">${icon('check')} Enregistrer l’exercice</button></div>`;
 showDialog('#editor-dialog');$('#editor-dialog').scrollTop=0;
}
function addEditorTag(key){
 const input=$(`[data-new-tag="${key}"]`),value=input.value.trim(),c=editorCategories.find(item=>item.id===key);if(!value||!c)return;
 const known=c.tags.find(t=>M.fold(t)===M.fold(value));if(!known)c.tags.push(value);
 const group=$(`[data-category-group="${key}"]`),selected=[...group.querySelectorAll('input:checked')].map(i=>i.value);group.outerHTML=editorTagGroup(c,M.unique([...selected,known||value]));$(`[data-new-tag="${key}"]`).focus();
}
async function readMedia(event){const file=event.target.files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>1024*1024){event.target.value='';toast('Choisissez une image PNG, JPEG, WebP ou GIF de 1 Mo maximum.');return;}try{const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Lecture impossible'));reader.readAsDataURL(file);});pendingMedia=M.safeMedia({type:'image',src});$('#media-type').value='image';$('[name="mediaUrl"]').value='';$('#media-status').textContent=`${file.name} · prêt à être enregistré`;}catch{toast('Cette image n’a pas pu être lue.');}}
function submitExercise(event){
 event.preventDefault();const form=event.target,data=new FormData(form),get=key=>String(data.get(key)||'').trim(),error=$('#editor-error');error.hidden=true;
 try{
 const tags={};for(const c of editorCategories)tags[c.id]=data.getAll(`tag:${c.id}`);
 for(const [key,label] of [['goal','un objectif thérapeutique'],['level','un niveau fonctionnel'],['position','une position de départ'],['equipment','le matériel nécessaire (ou « Sans matériel »)']]){if(!tags[key].length)throw new Error(`Sélectionnez ${label}.`);}
 if(tags.level.length!==1)throw new Error('Sélectionnez un seul niveau fonctionnel de référence.');
 if(tags.equipment.includes('Sans matériel')&&tags.equipment.length>1)throw new Error('Le tag « Sans matériel » ne peut pas être associé à un autre matériel indispensable.');
 let media={type:'illustration',src:''};const type=get('mediaType');if(type!=='illustration'){if(get('mediaUrl'))media=M.safeMedia({type,src:get('mediaUrl')});else if(type==='image'&&pendingMedia.type==='image'&&pendingMedia.src.startsWith('data:'))media=pendingMedia;else throw new Error('Ajoutez un média ou choisissez une illustration de la bibliothèque.');}
 const old=editorId?exercise(editorId):null,id=editorId||newId('ex'),now=new Date().toISOString();
 const record={id,name:get('name'),subtitle:get('subtitle'),tags,steps:get('steps').split('\n').map(v=>v.trim()).filter(Boolean),dosage:{},related:data.getAll('related'),art:get('art'),palette:get('palette'),media,createdAt:old?.createdAt||now,updatedAt:now};
 for(const key of ['objective','secondary','start','optional','success','precautions','easier','harder','comments'])record[key]=get(key);
 for(const key of ['sets','reps','duration','rest','intensity'])record.dosage[key]=get(key);
 const next=M.clone(state);next.categories=editorCategories;const index=next.exercises.findIndex(e=>e.id===id);if(index>=0)next.exercises[index]=record;else next.exercises.unshift(record);
 for(const item of next.exercises){if(item.id===id)continue;item.related=item.related.filter(key=>key!==id);if(record.related.includes(item.id))item.related.push(id);}
 if(save(next,old?'Exercice mis à jour.':'Exercice ajouté à votre bibliothèque.')){renderControls();closeDialog('#editor-dialog');openDetail(id);}else{error.textContent='La fiche n’a pas été enregistrée. Vérifiez le message affiché et réessayez.';error.hidden=false;}
 }catch(err){error.textContent=err.message;error.hidden=false;error.scrollIntoView({block:'center'});}
}
function confirmDeleteExercise(id){const e=exercise(id);if(!e)return;utility('Supprimer cet exercice ?',e.name,`<p>La fiche sera retirée de la bibliothèque, des favoris et des collections. Exportez vos données pour en conserver une copie.</p><div class="inline-form"><button class="button" data-action="close" data-dialog="utility-dialog">Annuler</button><button class="button danger" data-action="confirm-delete-exercise" data-id="${id}">Supprimer la fiche</button></div>`,'delete-exercise');}
function deleteExercise(id){if(change(next=>{next.exercises=next.exercises.filter(e=>e.id!==id);next.favorites=next.favorites.filter(key=>key!==id);next.collections.forEach(c=>c.exerciseIds=c.exerciseIds.filter(key=>key!==id));next.exercises.forEach(e=>e.related=e.related.filter(key=>key!==id));},'Exercice supprimé.')){closeDialog('#utility-dialog');closeDialog('#editor-dialog');closeDialog('#detail-dialog');}}
function openCollectionEditor(id=null,addExerciseId=null){const c=state.collections.find(item=>item.id===id);utility(c?'Modifier la collection':'Créer une collection','Un thème, un objectif, une sélection qui vous ressemble.',`<form id="collection-form" data-id="${id||''}" data-exercise-id="${addExerciseId||''}"><label for="collection-name">Nom de la collection *</label><input id="collection-name" name="name" maxlength="160" value="${escape(c?.name||'')}" placeholder="Ex. : Mobilité douce en chambre" required><label for="collection-description">Description</label><input id="collection-description" name="description" maxlength="1000" value="${escape(c?.description||'')}" placeholder="Quelques mots pour vous repérer"><div style="display:flex;gap:8px;margin-top:12px"><button class="button primary" type="submit">${icon('check')} Enregistrer</button>${c?`<button class="button danger" type="button" data-action="delete-collection" data-id="${c.id}">${icon('trash')} Supprimer</button>`:''}</div></form>`,'collection-editor');}
function submitCollection(event){event.preventDefault();const form=event.target,data=new FormData(form),id=form.dataset.id||newId('collection'),name=String(data.get('name')).trim();if(!name){toast('Indiquez un nom de collection.');return;}const addId=form.dataset.exerciseId;if(change(next=>{const c=next.collections.find(item=>item.id===id);if(c){c.name=name;c.description=String(data.get('description')).trim();}else next.collections.push({id,name,description:String(data.get('description')).trim(),exerciseIds:addId?[addId]:[]});},'Collection enregistrée.'))closeDialog('#utility-dialog');}
function collectionSelection(id){const e=exercise(id);if(!e)return;utility('Ajouter à une collection',e.name,`<form id="membership-form" data-id="${id}"><div class="collection-choices">${state.collections.map(c=>`<label class="collection-choice"><input type="checkbox" name="collection" value="${c.id}" ${c.exerciseIds.includes(id)?'checked':''}><span>${escape(c.name)}</span></label>`).join('')||'<p class="collection-empty">Créez votre première collection pour y retrouver cet exercice.</p>'}</div><button type="button" class="button" data-action="new-collection-from-exercise" data-id="${id}">${icon('plus')} Nouvelle collection</button>${state.collections.length?'<button type="submit" class="button primary">Enregistrer la sélection</button>':''}</form>`,'membership');}
function collectionExerciseSelection(id){const c=state.collections.find(item=>item.id===id);if(!c)return;utility('Les exercices de la collection',c.name,`<form id="collection-exercises-form" data-id="${id}"><div class="collection-choices">${state.exercises.map(e=>`<label class="collection-choice"><input type="checkbox" name="exercise" value="${e.id}" ${c.exerciseIds.includes(e.id)?'checked':''}><span>${escape(e.name)}</span></label>`).join('')}</div><button type="submit" class="button primary">Enregistrer la sélection</button></form>`,'collection-exercises');}
function confirmDeleteCollection(id){const c=state.collections.find(item=>item.id===id);if(!c)return;utility('Supprimer la collection ?',c.name,`<p>La collection sera supprimée. Ses exercices restent disponibles dans la bibliothèque.</p><button class="button danger" data-action="confirm-delete-collection" data-id="${id}">Supprimer la collection</button> <button class="button" data-action="close" data-dialog="utility-dialog">Annuler</button>`,'delete-collection');}
function openTags(){utility('Catégories & tags','Des repères cohérents, réutilisables dans toutes vos fiches.',`<p>Sélectionnez plusieurs tags par catégorie. Les filtres combinent les catégories entre elles ; au sein d’une catégorie, un tag sélectionné suffit.</p>${state.categories.map(c=>`<details class="tag-manager-group"><summary>${escape(c.name)} · ${c.tags.length} tags</summary><div class="check-options">${c.tags.map(t=>`<span class="chip">${escape(t)}<button data-action="delete-tag" data-key="${c.id}" data-value="${escape(t)}" aria-label="Supprimer le tag ${escape(t)}">×</button></span>`).join('')}</div><form class="inline-form" data-tag-form="${c.id}" style="margin-top:12px"><input name="tag" maxlength="120" placeholder="Nouveau tag" aria-label="Nouveau tag dans ${escape(c.name)}" required><button class="button" type="submit">Ajouter</button></form></details>`).join('')}<form id="category-form" class="category-add"><label for="category-name">Ajouter une catégorie</label><div class="inline-form"><input id="category-name" name="name" maxlength="120" placeholder="Ex. : Région anatomique" required><button class="button" type="submit">${icon('plus')} Ajouter</button></div></form><p class="notice" style="margin-top:20px">Un tag utilisé dans une fiche est conservé. Retirez-le d’abord des exercices concernés pour pouvoir le supprimer.</p>`,'tags');}
function addTag(event){event.preventDefault();const form=event.target,key=form.dataset.tagForm,value=new FormData(form).get('tag').trim(),c=category(key);if(!value||!c)return;if(c.tags.some(t=>M.fold(t)===M.fold(value))){toast('Ce tag existe déjà dans cette catégorie.');return;}if(change(next=>next.categories.find(item=>item.id===key).tags.push(value),'Tag ajouté.')){renderControls();openTags();$(`[data-tag-form="${key}"]`).closest('details').open=true;}}
function deleteTag(key,value){if(state.exercises.some(e=>e.tags[key]?.includes(value))){toast('Ce tag est utilisé dans une fiche. Retirez-le de ses exercices avant de le supprimer.');return;}if(change(next=>{const c=next.categories.find(item=>item.id===key);c.tags=c.tags.filter(t=>t!==value);},'Tag supprimé.')){filters[key]=(filters[key]||[]).filter(t=>t!==value);renderControls();render();openTags();$(`[data-tag-form="${key}"]`).closest('details').open=true;}}
function addCategory(event){event.preventDefault();const name=new FormData(event.target).get('name').trim();if(!name)return;if(state.categories.some(c=>M.fold(c.name)===M.fold(name))){toast('Une catégorie portant ce nom existe déjà.');return;}const id=newId('cat');if(change(next=>{next.categories.push({id,name,tags:[]});next.exercises.forEach(e=>{e.tags[id]=[];});},'Catégorie créée. Ajoutez ses premiers tags.')){renderControls();openTags();$(`[data-tag-form="${id}"]`).closest('details').open=true;}}
let pendingImport=null;
function openBackup(){pendingImport=null;utility('Sauvegarde & données','Votre bibliothèque vous appartient.',`<p>Vos fiches, favoris et collections sont conservés dans ce navigateur, sur cet appareil. Ils ne sont pas synchronisés entre le téléphone et l’ordinateur.</p><p class="notice">Exportez régulièrement votre bibliothèque, notamment avant de changer d’appareil ou d’effacer les données du navigateur. Les images importées sont incluses ; les médias liés à une adresse HTTPS restent dépendants de leur hébergeur.</p>${blockedStorage?'<div class="backup-option"><h3>Sauvegarde locale illisible</h3><p>Vous pouvez télécharger les données brutes avant de remplacer la sauvegarde par un import valide.</p><button class="button" data-action="export-raw">Télécharger les données brutes</button></div>':''}<div class="backup-option"><h3>Exporter ma bibliothèque</h3><p>${state.exercises.length} exercices · ${state.favorites.length} favoris · ${state.collections.length} collections. Format JSON réimportable sur un autre appareil.</p><button class="button primary" data-action="export-all">${icon('download')} Télécharger la sauvegarde</button></div><div class="backup-option"><h3>Restaurer une sauvegarde</h3><p>Choisissez un fichier JSON Kiné. Son contenu sera vérifié avant de vous proposer de remplacer vos données actuelles.</p><label for="import-file">Fichier de sauvegarde</label><input id="import-file" type="file" accept="application/json,.json"><div id="import-preview" role="status"></div></div>`,'backup');}
function download(content,filename,type='application/json'){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function exportData(id=null){let exported=M.clone(state),filename=`kine-sauvegarde-${new Date().toISOString().slice(0,10)}.json`;if(id){const c=exported.collections.find(item=>item.id===id);if(!c)return;const ids=new Set(c.exerciseIds);exported.exercises=exported.exercises.filter(e=>ids.has(e.id));exported.exercises.forEach(e=>e.related=e.related.filter(key=>ids.has(key)));exported.favorites=exported.favorites.filter(key=>ids.has(key));exported.collections=[c];filename=`kine-collection-${M.fold(c.name).replace(/[^a-z0-9]+/g,'-')||'selection'}.json`;}download(JSON.stringify({...exported,exportedAt:new Date().toISOString()},null,2),filename);toast('Sauvegarde téléchargée. Conservez ce fichier dans un endroit sûr.');}
async function prepareImport(event){const file=event.target.files[0],preview=$('#import-preview');preview.style.color='';pendingImport=null;if(!file)return;try{if(file.size>15*1024*1024)throw new Error('Le fichier dépasse 15 Mo.');pendingImport=M.validateState(JSON.parse(await file.text()));preview.innerHTML=`<p style="margin-top:14px;color:var(--green)">${pendingImport.exercises.length} exercices · ${pendingImport.favorites.length} favoris · ${pendingImport.collections.length} collections vérifiés.</p><p style="margin-top:8px">Cette action remplacera entièrement la bibliothèque de cet appareil. Exportez d’abord vos données actuelles pour les conserver.</p><button class="button primary" data-action="confirm-import">Remplacer mes données par cette sauvegarde</button>`;}catch(error){preview.textContent=`Import impossible : ${error instanceof SyntaxError?'le fichier n’est pas un JSON valide.':error.message}`;preview.style.color='#a54c3e';}}
function confirmImport(){if(!pendingImport)return;const wasBlocked=blockedStorage;blockedStorage=false;if(save(pendingImport,'Sauvegarde restaurée.')){pendingImport=null;closeDialog('#utility-dialog');closeDialog('#editor-dialog');closeDialog('#detail-dialog');viewMemory.clear();view='library';collectionId=null;resetFilters();}else blockedStorage=wasBlocked;}
function printExercise(id){const e=exercise(id);if(!e)return;const section=(title,body)=>`<section><h2>${title}</h2>${body}</section>`;$('#print-sheet').innerHTML=`<div class="print-header"><strong>KINÉ · BIBLIOTHÈQUE D’EXERCICES</strong><h1>${escape(e.name)}</h1><p>${escape(e.subtitle)}</p></div><div class="print-art">${e.media.type==='image'?imageMarkup(e):A.draw(e.art,e.palette)}</div>`+section('Objectifs',`<p><strong>Principal :</strong> ${escape(e.objective)}<br><strong>Secondaires :</strong> ${escape(e.secondary)}</p>`)+section('Position de départ',`<p>${escape(e.start)}</p>`)+section('Réalisation',`<ol>${e.steps.map(step=>`<li>${escape(step)}</li>`).join('')}</ol>`)+section('Dosage · repères à individualiser',`<dl>${Object.entries({sets:'Séries',reps:'Répétitions',duration:'Durée',rest:'Récupération',intensity:'Intensité'}).map(([key,label])=>`<div><dt>${label}</dt><dd>${escape(e.dosage[key]||'À adapter')}</dd></div>`).join('')}</dl>`)+section('Classification',`<p>${state.categories.map(c=>`<strong>${escape(c.name)} :</strong> ${escape(e.tags[c.id].join(', ')||'—')}`).join('<br>')}</p>`)+section('Matériel facultatif',`<p>${escape(e.optional||'Non renseigné')}</p>`)+section('Critères de réussite',`<p>${escape(e.success||'À renseigner')}</p>`)+section('Précautions',`<p>${escape(e.precautions||'À adapter à l’évaluation clinique.')}</p>`)+section('Variantes & progressions',`<p><strong>Plus facile :</strong> ${escape(e.easier)}<br><strong>Plus difficile :</strong> ${escape(e.harder)}${e.related.length?'<br><strong>Fiches liées :</strong> '+e.related.map(key=>escape(exercise(key)?.name||'')).join(', '):''}</p>`)+section('Commentaires personnels',`<p>${escape(e.comments||'—')}</p>`)+`<p class="print-footer">Support d’organisation professionnelle, sans prescription automatique. Exercice, assistance et dosage à adapter à l’évaluation clinique. Illustration schématique. Imprimé le ${new Date().toLocaleDateString('fr-FR')}.</p>`;window.print();}
function handleAction(event){
 const button=event.target.closest('[data-action]');if(!button)return;const {action,id,key,value,dialog}=button.dataset;
 switch(action){
 case 'new-entry':view==='collections'?openCollectionEditor():openEditor();break;
 case 'apply-mobile-filters':applyMobileFilters();break;
 case 'clear-mobile-filters':draftFilters={};$$('#mobile-filter-fields input').forEach(input=>{input.checked=false;});updateFilterPreview();break;
 case 'detail-jump':{const target=document.getElementById(button.dataset.target);target?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});target?.focus({preventScroll:true});break;}
 case 'detail-menu':utility('Actions sur la fiche',exercise(id)?.name||'',`<div class="sheet-menu"><button class="settings-link" data-action="mobile-edit" data-id="${id}">${icon('edit')}<span>Modifier l’exercice</span>${icon('chevron')}</button><button class="settings-link" data-action="mobile-print" data-id="${id}">${icon('print')}<span>Imprimer ou enregistrer en PDF</span>${icon('chevron')}</button></div>`,'detail-menu');break;
 case 'mobile-edit':closeDialog('#utility-dialog');openEditor(id);break;
 case 'mobile-print':closeDialog('#utility-dialog');printExercise(id);break;
 case 'close':closeDialog(`#${dialog}`);break;
 case 'filter':toggleFilter(key,value);break;
 case 'all-goals':filters.goal=[];renderControls();render();break;
 case 'reset':resetFilters();break;
 case 'detail':openDetail(id);break;
 case 'favorite':case 'favorite-detail':toggleFavorite(id);break;
 case 'edit':openEditor(id);break;
 case 'editor-add-tag':addEditorTag(key);break;
 case 'delete-exercise':confirmDeleteExercise(id);break;
 case 'confirm-delete-exercise':deleteExercise(id);break;
 case 'new-collection':openCollectionEditor();break;
 case 'edit-collection':openCollectionEditor(id);break;
 case 'new-collection-from-exercise':openCollectionEditor(null,id);break;
 case 'open-collection':go('collection',id);break;
 case 'back-collections':go('collections');break;
 case 'library':go('library');break;
 case 'delete-collection':confirmDeleteCollection(id);break;
 case 'confirm-delete-collection':if(change(next=>{next.collections=next.collections.filter(c=>c.id!==id);},'Collection supprimée.'))closeDialog('#utility-dialog');break;
 case 'add-to-collection':collectionSelection(id);break;
 case 'select-collection-exercises':collectionExerciseSelection(id);break;
 case 'delete-tag':deleteTag(key,value);break;
 case 'export-all':exportData();break;
 case 'export-collection':exportData(id);break;
 case 'export-raw':try{download(localStorage.getItem(KEY)||'{}','kine-donnees-brutes.json');}catch{toast('Les données du navigateur sont inaccessibles.');}break;
 case 'confirm-import':confirmImport();break;
 case 'print':printExercise(id);break;
 case 'backup':openBackup();break;
 case 'tags':openTags();break;
 }
}
document.addEventListener('click',handleAction);
document.addEventListener('submit',event=>{
 const form=event.target;if(form.id==='exercise-form')submitExercise(event);
 else if(form.id==='collection-form')submitCollection(event);
 else if(form.dataset.tagForm)addTag(event);
 else if(form.id==='category-form')addCategory(event);
 else if(form.id==='membership-form'){event.preventDefault();const selected=new FormData(form).getAll('collection'),id=form.dataset.id;if(change(next=>{next.collections.forEach(c=>{c.exerciseIds=c.exerciseIds.filter(key=>key!==id);if(selected.includes(c.id))c.exerciseIds.push(id);});},'Collections mises à jour.'))closeDialog('#utility-dialog');}
 else if(form.id==='collection-exercises-form'){event.preventDefault();const selected=new FormData(form).getAll('exercise'),id=form.dataset.id;if(change(next=>{next.collections.find(c=>c.id===id).exerciseIds=selected;},'Sélection enregistrée.'))closeDialog('#utility-dialog');}
});
document.addEventListener('change',event=>{const el=event.target;if(el.dataset.mobileFilter&&draftFilters){const key=el.dataset.mobileFilter,values=draftFilters[key]||[];draftFilters[key]=el.checked?M.unique([...values,el.value]):values.filter(value=>value!==el.value);updateFilterPreview();}if(el.dataset.filter)toggleFilter(el.dataset.filter,el.value);if(el.id==='media-file')readMedia(event);if(el.id==='import-file')prepareImport(event);});
$('#search').addEventListener('input',event=>{query=event.target.value;render();});
$('#clear-search').addEventListener('click',()=>{query='';$('#search').value='';render();$('#search').focus();});
$('#search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.target.blur();}});
$('#sort').addEventListener('change',event=>{sort=event.target.value;render();});
$('#toggle-filters').addEventListener('click',()=>{if(phoneMedia.matches){openMobileFilters();return;}const panel=$('#filter-panel');panel.hidden=!panel.hidden;$('#toggle-filters').setAttribute('aria-expanded',String(!panel.hidden));});
$('#reset-filters').addEventListener('click',resetFilters);
$('#grid-view').addEventListener('click',()=>{listMode=false;$('#grid-view').classList.add('selected');$('#list-view').classList.remove('selected');$('#grid-view').setAttribute('aria-pressed','true');$('#list-view').setAttribute('aria-pressed','false');render();});
$('#list-view').addEventListener('click',()=>{listMode=true;$('#list-view').classList.add('selected');$('#grid-view').classList.remove('selected');$('#list-view').setAttribute('aria-pressed','true');$('#grid-view').setAttribute('aria-pressed','false');render();});
$$('[data-view]').forEach(button=>button.addEventListener('click',()=>go(button.dataset.view)));
$('.brand').addEventListener('click',event=>{event.preventDefault();go('library');});
$('#add-exercise').addEventListener('click',()=>view==='collections'?openCollectionEditor():openEditor());
$('#manage-tags').addEventListener('click',openTags);$('#backup-button').addEventListener('click',openBackup);
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}));
document.addEventListener('keydown',event=>{const editing=event.target.closest('input,textarea,select,[contenteditable]');if(event.key==='/'&&!editing&&!$('dialog[open]')&&view!=='collections'&&view!=='settings'){event.preventDefault();$('#search').focus();}if(event.key==='Enter'&&event.target.dataset.newTag){event.preventDefault();addEditorTag(event.target.dataset.newTag);}});
window.addEventListener('storage',event=>{if(event.key!==KEY||!event.newValue)return;if($('#editor-dialog').open||$('#utility-dialog').open){toast('La bibliothèque a changé dans un autre onglet. Fermez votre formulaire et rechargez avant de modifier les données.');blockedStorage=true;return;}try{state=M.validateState(JSON.parse(event.newValue));resetFilters();if($('#detail-dialog').open){if(exercise(detailId))openDetail(detailId);else closeDialog('#detail-dialog');}toast('Bibliothèque actualisée depuis un autre onglet.');}catch{toast('Les nouvelles données d’un autre onglet sont invalides.');}});

$$('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{if(dialog.id==='filters-dialog'){$('#toggle-filters').setAttribute('aria-expanded','false');draftFilters=null;}queueMicrotask(syncModalHistory);}));
window.addEventListener('popstate',event=>{
 const automatic=historyClosing;historyClosing=false;modalHistory=Boolean(event.state?.kineOverlay);
 if(!automatic){const dialogs=$$('dialog[open]');dialogs.at(-1)?.close();}
 if(!$('dialog[open]')&&modalHistory){history.replaceState({...(history.state||{}),kineOverlay:false},'');modalHistory=false;}
 queueMicrotask(syncModalHistory);
});
phoneMedia.addEventListener('change',()=>{renderControls();render();});
if(window.visualViewport){const updateKeyboard=()=>{const editing=document.activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]),textarea,select');document.body.classList.toggle('keyboard-open',Boolean(editing&&window.innerHeight-window.visualViewport.height>120));};window.visualViewport.addEventListener('resize',updateKeyboard);document.addEventListener('focusout',()=>requestAnimationFrame(updateKeyboard));}

hydrate();renderControls();render();if(storageProblem)setTimeout(()=>toast(storageProblem),500);
})();
