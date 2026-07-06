function AnalyticsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/pdf-report'); setData(await r.json()); } catch {} finally { setLoading(false); }
    })();
  }, []);

  const generatePDF = async () => {
    setGeneratingPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      doc.setFillColor(5, 5, 11); doc.rect(0, 0, 210, 297, 'F');
      doc.setTextColor(192, 0, 28); doc.setFontSize(22); doc.text('M.B.A // Mwango Brain Agent', 20, 30);
      doc.setTextColor(144, 144, 170); doc.setFontSize(10); doc.text('Relatório de Prospecção — ' + new Date().toLocaleDateString('pt-PT'), 20, 38);
      doc.setDrawColor(192, 0, 28); doc.line(20, 42, 190, 42);
      let y = 55;
      doc.setTextColor(242, 242, 250); doc.setFontSize(12); doc.text('RESUMO GERAL', 20, y); y += 10;
      doc.setFontSize(10);
      if (data) {
        const rows = [['Total de perfis', String(data.totalProfiles)], ['Mensagens enviadas', String(data.outbound)], ['Mensagens recebidas', String(data.inbound)], ['Taxa de resposta', data.responseRate + '%'], ['Total de campanhas', String(data.totalCampaigns)], ['Follow-ups pendentes', String(data.pendingFollowUps || 0)]];
        for (const [label, val] of rows) {
          doc.setTextColor(144, 144, 170); doc.text(label + ':', 25, y);
          doc.setTextColor(242, 242, 250); doc.text(val, 120, y);
          y += 8;
        }
        y += 10;
        doc.setTextColor(242, 242, 250); doc.setFontSize(12); doc.text('POR PLATAFORMA', 20, y); y += 10;
        doc.setFontSize(10);
        for (const p of (data.byPlatform || [])) {
          doc.setTextColor(144, 144, 170); doc.text(p.platform + ':', 25, y);
          doc.setTextColor(242, 242, 250); doc.text(String(p._count) + ' perfis', 120, y);
          y += 8;
        }
        y += 10;
        doc.setTextColor(242, 242, 250); doc.setFontSize(12); doc.text('TOP 10 PERFIS', 20, y); y += 10;
        doc.setFontSize(9);
        for (let i = 0; i < (data.topProfiles || []).length; i++) {
          const p = data.topProfiles[i];
          doc.setTextColor(255, 26, 60); doc.text(String(i+1) + '. ' + p.username, 25, y);
          doc.setTextColor(144, 144, 170); doc.text(p.platform + ' | ' + (p.followers||0).toLocaleString() + ' seg | Score: ' + Math.round(p.score), 70, y);
          y += 7;
        }
        y += 10;
        doc.setTextColor(242, 242, 250); doc.setFontSize(12); doc.text('ACTIVIDADE 7 DIAS', 20, y); y += 10;
        doc.setFontSize(9);
        for (const d of (data.dailyStats || [])) {
          doc.setTextColor(144, 144, 170); doc.text(d.date + ' (' + d.dayName + ')', 25, y);
          doc.setTextColor(242, 242, 250); doc.text('Contactados: ' + d.contacted + ' | Respostas: ' + d.replied + ' | Aceites: ' + d.accepted, 80, y);
          y += 7;
        }
      }
      doc.setTextColor(90, 90, 100); doc.setFontSize(8); doc.text('Gerado por M.B.A — LUANDA · ANGOLA · mwangobrain.com', 20, 280);
      doc.save('MBA_Relatorio_' + new Date().toISOString().slice(0, 10) + '.pdf');
    } catch (e: any) { alert('Erro ao gerar PDF: ' + e.message); }
    setGeneratingPDF(false);
  };

  if (loading) return <div style={{ padding:16 }}><Panel><div style={{ textAlign:'center', padding:48, color:P.textDim }}>A carregar dados...</div></Panel></div>;
  if (!data) return <div style={{ padding:16 }}><Panel><div style={{ textAlign:'center', padding:48, color:P.textDim }}>Sem dados.</div></Panel></div>;

  const maxDaily = Math.max(...(data.dailyStats||[]).map((d: any) => Math.max(d.contacted, d.replied, d.accepted)), 1);

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <StatCard label="Total perfis" value={data.totalProfiles} />
          <StatCard label="Enviadas" value={data.outbound} color={P.orange} />
          <StatCard label="Recebidas" value={data.inbound} color={P.green} />
          <StatCard label="Taxa resposta" value={data.responseRate+'%'} color={P.blue} />
        </div>
        <Btn onClick={generatePDF} disabled={generatingPDF}>{generatingPDF?'A gerar PDF...':'⬇ Exportar PDF'}</Btn>
      </div>

      <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:14, marginBottom:14 }}>
        <Panel><STitle>Actividade últimos 7 dias</STitle>
          <div style={{ display:'flex', gap:16, marginBottom:12, fontSize:10 }}>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:10, height:10, borderRadius:2, background:P.orange }} />Contactados</span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:10, height:10, borderRadius:2, background:P.green }} />Respostas</span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:10, height:10, borderRadius:2, background:P.blue }} />Aceites</span>
          </div>
          {(data.dailyStats || []).map((ds: any, i: number) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-end', gap:2, marginBottom:6, height:60 }}>
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                <div style={{ display:'flex', alignItems:'flex-end', gap:2, width:'100%', height:50 }}>
                  <div style={{ flex:1, height: Math.max(2, (ds.contacted/maxDaily)*50), background:P.orange, borderRadius:'2px 2px 0 0', opacity:0.8, transition:'height .3s' }} />
                  <div style={{ flex:1, height: Math.max(2, (ds.replied/maxDaily)*50), background:P.green, borderRadius:'2px 2px 0 0', opacity:0.8, transition:'height .3s' }} />
                  <div style={{ flex:1, height: Math.max(2, (ds.accepted/maxDaily)*50), background:P.blue, borderRadius:'2px 2px 0 0', opacity:0.8, transition:'height .3s' }} />
                </div>
                <span style={{ color:P.textDim, fontSize:9, fontFamily:"'JetBrains Mono',monospace" }}>{ds.dayName}</span>
              </div>
            </div>
          ))}
        </Panel>
        <Panel><STitle>Por Plataforma</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(data.byPlatform || []).map((p: any, i: number) => {
              const colors = [P.red, P.orange, P.blue, P.green];
              const total = (data.byPlatform || []).reduce((s: number, x: any) => s + x._count, 0) || 1;
              return <div key={i}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ color:P.textSec, fontSize:11, textTransform:'capitalize' }}>{p.platform}</span><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{p._count} ({Math.round(p._count/total*100)}%)</span></div>
                <Bar value={p._count} max={total} color={colors[i%4]} h={8} />
              </div>;
            })}
            {(!data.byPlatform || !data.byPlatform.length) && <div style={{ color:P.textDim, fontSize:12, textAlign:'center', padding:24 }}>Sem dados</div>}
          </div>
        </Panel>
      </div>

      <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Panel><STitle>Estado dos Perfis</STitle>
          {(data.byStatus || []).map((s: any, i: number) => {
            const total = (data.byStatus || []).reduce((sum: number, x: any) => sum + x._count, 0) || 1;
            const cols: Record<string, string> = { prospect:P.textSec, contacted:P.orange, replied:P.blue, accepted:P.green, rejected:'#ff6b6b' };
            return <div key={i} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ color:P.textSec, fontSize:11, textTransform:'capitalize' }}>{s.status}</span><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{s._count} ({Math.round(s._count/total*100)}%)</span></div>
              <Bar value={s._count} max={total} color={cols[s.status]||P.textDim} h={8} />
            </div>;
          })}
        </Panel>
        <Panel><STitle>Top 10 Perfis</STitle>
          {(data.topProfiles || []).map((p: any, i: number) => (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:i<9?'1px solid '+P.border:'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ color:P.textDim, fontSize:10, width:18, fontFamily:"'JetBrains Mono',monospace" }}>{i+1}.</span><span style={{ color:P.redB, fontSize:12, fontWeight:600 }}>{p.username}</span><span style={{ color:P.textDim, fontSize:10, textTransform:'capitalize' }}>{p.platform}</span></div>
              <span style={{ padding:'2px 7px', borderRadius:3, background:'rgba(192,0,28,0.15)', border:'1px solid '+P.border, color:p.score>=80?P.green:P.red, fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:600 }}>{Math.round(p.score)}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}