/* Fonctions de données partagées par l’interface et les tests Node. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KineModel=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const core=['goal','level','equipment','position','muscles','capacity','context'];
  const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[’']/g,' ').trim();
  const unique=values=>[...new Set(values)];
  const clone=value=>JSON.parse(JSON.stringify(value));
  function text(value,max=20000){if(typeof value!=='string'||value.length>max)throw new Error('Un champ texte est manquant ou trop long.');return value.trim();}
  function id(value){const v=text(value,100);if(!/^[a-zA-Z0-9_-]+$/.test(v)||['__proto__','constructor','prototype'].includes(v))throw new Error('Un identifiant est invalide.');return v;}
  function safeMedia(media){
    if(!media||media.type==='illustration')return {type:'illustration',src:''};
    if(!['image','video'].includes(media.type))throw new Error('Type de média non pris en charge.');
    const src=text(media.src,3000000);
    if(media.type==='image'&&/^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(src))return {type:'image',src};
    let url;try{url=new URL(src);}catch{throw new Error('Le média doit avoir une adresse HTTPS valide.');}
    if(url.protocol!=='https:'||url.username||url.password)throw new Error('Le média doit avoir une adresse HTTPS sans identifiants.');
    return {type:media.type,src:url.href};
  }
  function canonical(values){const found=new Map();for(const value of values){const v=text(value,120);if(v&&!found.has(fold(v)))found.set(fold(v),v);}return [...found.values()];}
  function validateState(input){
    if(!input||input.version!==1||!Array.isArray(input.categories)||!Array.isArray(input.exercises)||!Array.isArray(input.favorites)||!Array.isArray(input.collections))throw new Error('Ce fichier n’est pas une sauvegarde Kiné version 1.');
    if(input.categories.length>50||input.exercises.length>5000||input.collections.length>500)throw new Error('Cette sauvegarde dépasse les limites de la bibliothèque.');
    const categories=input.categories.map(c=>{if(!Array.isArray(c.tags)||c.tags.length>300)throw new Error('Catégorie de tags invalide.');return {id:id(c.id),name:text(c.name,120),tags:canonical(c.tags)};});
    if(categories.some(c=>!c.name))throw new Error('Chaque catégorie doit avoir un nom.');
    if(new Set(categories.map(c=>c.id)).size!==categories.length||new Set(categories.map(c=>fold(c.name))).size!==categories.length)throw new Error('Des catégories sont présentes en double.');
    if(core.some(key=>!categories.some(c=>c.id===key)))throw new Error('Une catégorie de base est absente de la sauvegarde.');
    const exercises=input.exercises.map(e=>{
      const result={id:id(e.id),name:text(e.name,180),subtitle:text(e.subtitle||'',300),tags:{},dosage:{},media:safeMedia(e.media)};
      if(!result.name)throw new Error('Chaque exercice doit avoir un nom.');
      for(const key of ['objective','secondary','start','optional','success','precautions','easier','harder','comments'])result[key]=text(e[key]||'');
      if(!Array.isArray(e.steps)||e.steps.length>100)throw new Error('Les consignes d’un exercice sont invalides.');
      result.steps=e.steps.map(step=>text(step,4000)).filter(Boolean);
      if(!e.tags||typeof e.tags!=='object')throw new Error('Les tags d’un exercice sont invalides.');
      for(const c of categories){const values=e.tags[c.id]||[];if(!Array.isArray(values))throw new Error('Les tags doivent être une liste.');result.tags[c.id]=canonical(values).map(v=>{const known=c.tags.find(t=>fold(t)===fold(v));if(!known)throw new Error(`Tag inconnu dans « ${c.name} » : ${v}`);return known;});}
      for(const key of ['sets','reps','duration','rest','intensity'])result.dosage[key]=text(e.dosage?.[key]||'',300);
      result.related=Array.isArray(e.related)?unique(e.related.map(id)):[];
      result.art=['sitstand','knee','tandem','arms','march','ball','heels','band','shift','seatedmarch','squat','step','ankle','hands','lying','walking'].includes(e.art)?e.art:'sitstand';
      result.palette=['sage','sand','blue','rose','lavender'].includes(e.palette)?e.palette:'sage';
      result.createdAt=typeof e.createdAt==='string'&&Number.isFinite(Date.parse(e.createdAt))?new Date(e.createdAt).toISOString():new Date().toISOString();
      result.updatedAt=typeof e.updatedAt==='string'&&Number.isFinite(Date.parse(e.updatedAt))?new Date(e.updatedAt).toISOString():result.createdAt;
      return result;
    });
    const ids=new Set(exercises.map(e=>e.id));if(ids.size!==exercises.length)throw new Error('Des exercices ont le même identifiant.');
    for(const e of exercises)if(e.related.some(key=>!ids.has(key)||key===e.id))throw new Error('Un lien entre variantes est invalide.');
    const favorites=unique(input.favorites.map(id)).filter(key=>ids.has(key));
    const collections=input.collections.map(c=>{if(!Array.isArray(c.exerciseIds))throw new Error('Collection invalide.');const name=text(c.name,160);if(!name)throw new Error('Une collection doit avoir un nom.');return {id:id(c.id),name,description:text(c.description||'',1000),exerciseIds:unique(c.exerciseIds.map(id)).filter(key=>ids.has(key))};});
    if(new Set(collections.map(c=>c.id)).size!==collections.length)throw new Error('Des collections ont le même identifiant.');
    return {version:1,categories,exercises,favorites,collections};
  }
  function matches(exercise,query,filters){
    const haystack=fold([exercise.name,exercise.subtitle,exercise.objective,exercise.secondary,exercise.start,exercise.steps.join(' '),exercise.comments,exercise.optional,exercise.success,exercise.precautions,exercise.easier,exercise.harder,...Object.values(exercise.dosage),...Object.values(exercise.tags).flat()].join(' '));
    if(fold(query).split(/\s+/).filter(Boolean).some(word=>!haystack.includes(word)))return false;
    return Object.entries(filters).every(([key,values])=>!values.length||values.some(value=>(exercise.tags[key]||[]).includes(value)));
  }
  function selectExercises(state,{view='library',collectionId=null,query='',filters={},sort='default'}={}){
    let items=state.exercises.filter(e=>matches(e,query,filters));
    if(view==='favorites')items=items.filter(e=>state.favorites.includes(e.id));
    if(view==='collection'){const selected=state.collections.find(c=>c.id===collectionId);items=items.filter(e=>selected?.exerciseIds.includes(e.id));}
    if(sort==='name')items.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    if(sort==='recent')items.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
    if(sort==='level'){const levels=state.categories.find(c=>c.id==='level').tags;items.sort((a,b)=>levels.indexOf(a.tags.level[0])-levels.indexOf(b.tags.level[0]));}
    return items;
  }
  return {fold,unique,clone,canonical,validateState,safeMedia,matches,selectExercises,core};
});
