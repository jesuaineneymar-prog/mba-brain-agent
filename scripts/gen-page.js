const fs = require('fs');

const content = `\
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useMBAStore } from '@/store/mba-store';

const getSessionId = () => { try { return localStorage.getItem('mba_session') || ''; } catch { return ''; } };
const mbaFetch = async (url: string, opts: RequestInit = {}) => {
  const sid = getSessionId();
  const headers = new Headers(opts.headers || {});
  if (sid) headers.set('x-mba-session', sid);
  if (!headers.has('Content-Type') && opts.body && typeof opts.body === 'string') headers.set('Content-Type', 'application/json');
  return fetch(url, { ...opts, headers });
};

const P = {
  bg:'#05050B', surface:'#0E0E1C', surface2:'#141428',
  red:'#C0001C', redB:'#FF1A3C',
  redGlow:'rgba(192,0,28,0.18)', redDim:'rgba(192,0,28,0.08)',
  border:'rgba(192,0,28,0.14)', borderHi:'rgba(192,0,28,0.35)',
  text:'#F2F2FA', textSec:'#9090AA', textDim:'#505068',
  green:'#00C063', orange:'#E06000', blue:'#3B82F6',
};
const INP: React.CSSProperties = { width:'100%', padding:'9px 13px', background:P.surface2, border:'1px solid '+P.border, borderRadius:6, color:P.text, fontSize:13, outline:'none', fontFamily:"'JetBrains Mono',monospace" };
const LIMIT_DIARIO = 30;
const PROPOSTA = 'Ola,\\nO meu nome e Jesuaine Cristiano e represento a Mwango Brain, uma agencia criativa sediada em Luanda, Angola.\\nTenho acompanhado o seu perfil com interesse e gostaria de lhe apresentar uma proposta de aquisicao da sua conta.\\n\\nEstamos dispostos a fazer uma oferta justa pelo seu perfil. Caso tenha interesse em saber mais detalhes, basta responder a esta mensagem e entraremos em contacto rapidamente.\\n\\nAguardamos o seu contacto.\\nCumprimentos,\\nEquipa Mwango Brain\\nmwangobrain.com';
const TABS = [
  {id:'dashboard',label:'DASHBOARD'},{id:'prospecting',label:'PROSPECCAO'},{id:'messages',label:'MENSAGENS'},
  {id:'followups',label:'FOLLOW-UPS'},{id:'inbox',label:'INBOX'},{id:'agent',label:'AGENTE IA'},
  {id:'campaigns',label:'CAMPANHAS'},{id:'analytics',label:'ANALYTICS'},{id:'activity',label:'ACTIVIDADE'},{id:'config',label:'CONFIGURACAO'},
];
const storeGet = (k:string, d:string='') => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const storeSet = (k:string, v:string) => { try { localStorage.setItem(k, v); } catch {} };
const exportCSV = (profiles:any[])=>{if(!profiles.length)return;const h=['Handle','Nome','Seguidores','Score','Plataforma','URL'];const rows=profiles.map(p=>[p.username||p.handle,p.displayName,p.followers,p.score,p.platform,p.profileUrl]);const csv=[h,...rows].map(r=>r.map(v=>\`"\${String(v).replace(/"/g,"'\")}"\`).join(',')).join('\\n');const blob=new Blob(['\\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=\`MBA_\${new Date().toISOString().slice(0,10)}.csv\`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);};
const fmtDt = (d:string) => { try { return new Date(d).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch { return d; } };
const statusColors: Record<string, string> = { prospect: P.textSec, contacted: P.orange, replied: P.blue, accepted: P.green, rejected: '#ff6b6b', blacklisted: '#666' };
const statusLabels: Record<string, string> = { prospect:'Prospecto', contacted:'Contactado', replied:'Respondeu', accepted:'Aceite', rejected:'Rejeitado', blacklisted:'Blacklist' };
`;

console.log('Script approach too complex with escaping. Use direct file write instead.');
