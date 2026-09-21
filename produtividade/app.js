
(function(){
  "use strict";

  var SHEETS = {
    "MONTADOS": {label:"Montados", cols:["O.S","DATA","CLIENTE","TECNICO","DATA FINAL","STATUS"], dates:["DATA","DATA FINAL"], status:true},
    "ENROLADOR": {label:"Enrolador", cols:["O.S","DATA","CLIENTE","TECNICO","COR","POTÊNCIA"], dates:["DATA"]},
    "APROVADOS": {label:"Aprovados", cols:["O.S","DATA","CLIENTE","TECNICO","STATUS"], dates:["DATA"], status:true},
    "ANALISADOS": {label:"Analisados", cols:["O.S","DATA","CLIENTE","TECNICO"], dates:["DATA"]},
    "ERROS APONTAMENTO": {label:"Erros de apontamento", cols:["O.S","ERRO","QUEM CAUSOU","DATA"], dates:["DATA"]}
  };
  var KEY = "produtividade-oficina-v1";
  var seed = window.PRODUTIVIDADE_SEED || {};
  var state = {
    data: loadData(),
    view:"dashboard",
    sheet:"MONTADOS",
    search:"",
    status:"",
    page:1,
    prod:{tech:"",from:"",to:"",sheet:"TODAS",search:""}
  };

  function cp(v){ return JSON.parse(JSON.stringify(v)); }
  function emptyData(){
    return {
      "MONTADOS":[], "ENROLADOR":[], "APROVADOS":[],
      "ANALISADOS":[], "ERROS APONTAMENTO":[]
    };
  }
  function loadData(){
    try{
      var raw=localStorage.getItem(KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    return Object.keys(seed).length ? cp(seed) : emptyData();
  }
  function save(){ localStorage.setItem(KEY,JSON.stringify(state.data)); }
  function rows(s){ return state.data[s] || []; }
  function esc(v){
    return String(v == null ? "" : v)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function dateNorm(v){
    if(v==null || v==="") return "";
    v=String(v).trim();
    if(/^\\d{4}-\\d{2}-\\d{2}$/.test(v)) return v;
    var m=v.match(/^(\\d{2})[\\/.-](\\d{2})[\\/.-](\\d{4})$/);
    return m ? m[3]+"-"+m[2]+"-"+m[1] : v;
  }
  function dateBR(v){
    var n=dateNorm(v), m=n.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
    return m ? m[3]+"/"+m[2]+"/"+m[1] : (v || "");
  }
  function status(row){
    var d=dateNorm(row.DATA), f=dateNorm(row["DATA FINAL"]);
    if(!f || f==="S/D") return "NO PRAZO";
    if(!d) return row.STATUS || "NO PRAZO";
    return f>=d ? "NO PRAZO" : "ATRASADO";
  }
  function unique(s,c){
    var a=rows(s).map(function(r){return String(r[c]||"").trim();}).filter(Boolean);
    return Array.from(new Set(a)).sort(function(a,b){return a.localeCompare(b,"pt-BR");});
  }
  function counts(){
    var m=rows("MONTADOS"), a=rows("APROVADOS");
    return {
      montados:m.length, noPrazo:m.filter(function(r){return r.STATUS==="NO PRAZO";}).length,
      atrasados:m.filter(function(r){return r.STATUS==="ATRASADO";}).length,
      enrolador:rows("ENROLADOR").length, aprovados:a.length,
      aprovadosOk:a.filter(function(r){return r.STATUS==="OK";}).length,
      aprovadosRep:a.filter(function(r){return r.STATUS==="REP";}).length,
      analisados:rows("ANALISADOS").length, erros:rows("ERROS APONTAMENTO").length
    };
  }
  function persistStatuses(){
    state.data.MONTADOS=rows("MONTADOS").map(function(r){var x=cp(r);x.STATUS=status(x);return x;});
    save(); render();
  }
  function slug(s){return s.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
  function download(name,text,type){
    var b=new Blob([text],{type:type||"text/plain;charset=utf-8"});
    var u=URL.createObjectURL(b), a=document.createElement("a");
    a.href=u; a.download=name; a.click(); setTimeout(function(){URL.revokeObjectURL(u);},500);
  }
  function csv(v){
    var s=String(v==null?"":v);
    return /[";,\n]/.test(s) ? "\"" + s.replace(/"/g,"\"\"") + "\"" : s;
  }
  function exportSheet(s){
    var h=SHEETS[s].cols, out=[h.map(csv).join(";")];
    rows(s).forEach(function(r){out.push(h.map(function(c){return csv(r[c]);}).join(";"));});
    download(slug(s)+".csv","\\uFEFF"+out.join("\n"),"text/csv;charset=utf-8");
  }
  function exportBackup(){download("produtividade-oficina-backup.json",JSON.stringify(state.data,null,2),"application/json;charset=utf-8");}
  function parseCSV(text){
    var lines=[], row=[], cur="", q=false, d=";";
    var first=(text.split(/\\r?\\n/).find(function(x){return x.trim();})||"");
    if(first.indexOf(";")<0 && first.indexOf(",")>=0) d=",";
    for(var i=0;i<text.length;i++){
      var ch=text[i], nx=text[i+1];
      if(ch==="\""){ if(q && nx==="\""){cur+="\"";i++;} else q=!q; }
      else if(ch===d && !q){row.push(cur);cur="";}
      else if((ch==="\\n"||ch==="\\r")&&!q){
        if(ch==="\\r"&&nx==="\\n") i++;
        row.push(cur);cur="";
        if(row.some(function(x){return String(x).trim();})) lines.push(row);
        row=[];
      } else cur+=ch;
    }
    if(cur!==""||row.length){row.push(cur);if(row.some(function(x){return String(x).trim();}))lines.push(row);}
    return {h:(lines.shift()||[]).map(function(x){return x.replace(/^\\uFEFF/,"").trim().toUpperCase();}),r:lines};
  }
  function importCSV(text,s){
    var p=parseCSV(text), spec=SHEETS[s], map={};
    spec.cols.forEach(function(c){var i=p.h.indexOf(c);if(i>=0)map[c]=i;});
    if(Object.keys(map).length<2) throw new Error("CSV incompatível com a base.");
    p.r.forEach(function(v){
      var x={};
      spec.cols.forEach(function(c){
        var i=map[c], z=i==null?"":String(v[i]||"").trim();
        x[c]=spec.dates.indexOf(c)>=0?dateNorm(z):z;
        if(c==="O.S" && /^\\d+$/.test(z)) x[c]=Number(z);
      });
      if(s==="MONTADOS")x.STATUS=status(x);
      rows(s).push(x);
    });
    save(); render();
  }
  function currentRows(){
    var s=state.sheet, q=state.search.toLowerCase().trim(), out=rows(s).filter(function(r){
      return !q || Object.values(r).join(" ").toLowerCase().indexOf(q)>=0;
    });
    if(state.status && SHEETS[s].status) out=out.filter(function(r){return r.STATUS===state.status;});
    var dc=SHEETS[s].dates[0];
    return out.sort(function(a,b){return String(b[dc]||"").localeCompare(String(a[dc]||""));});
  }
  function productivityRows(){
    var list=state.prod.sheet==="TODAS"?Object.keys(SHEETS):[state.prod.sheet], out=[];
    list.forEach(function(s){
      rows(s).forEach(function(r){
        var d=dateNorm(r.DATA), t=String(r.TECNICO||"");
        if(state.prod.tech && t!==state.prod.tech)return;
        if(state.prod.from && d<state.prod.from)return;
        if(state.prod.to && d>state.prod.to)return;
        if(state.prod.search && Object.values(r).join(" ").toLowerCase().indexOf(state.prod.search.toLowerCase())<0)return;
        out.push(Object.assign({__sheet:s},r));
      });
    });
    return out;
  }
  function pill(v){
    var c=v==="OK"||v==="NO PRAZO"?"ok":(v==="REP"?"rep":(v==="ATRASADO"?"bad":"neutral"));
    return "<span class=\"pill "+c+"\">"+esc(v)+"</span>";
  }
  function nav(){
    var c=counts();
    var items=[
      ["dashboard","Dashboard"],["produtividade","Produtividade"],
      ["dados","Bases de dados"],["erros","Erros de apontamento"],["backup","Backup / dados"]
    ];
    return "<aside class=\"sidebar\"><div class=\"brand\"><small>OFICINA</small><h1>Produtividade</h1><p>Controle web no lugar do Excel</p></div><nav>"+
      items.map(function(x){return "<button class=\""+(state.view===x[0]?"active":"")+"\" data-nav=\""+x[0]+"\">"+esc(x[1])+(x[0]==="erros"?" <b class=\"badge\">"+c.erros+"</b>":"")+"</button>";}).join("")+
      "</nav><footer>Os dados desta versão ficam no navegador. Use o backup JSON para transportar a base.</footer></aside>";
  }
  function top(title,desc){
    return "<div class=\"top\"><div><h2>"+esc(title)+"</h2><p>"+esc(desc)+"</p></div><div class=\"actions\"><button class=\"btn\" data-act=\"new\">+ Novo</button><button class=\"btn primary\" data-act=\"print\">Imprimir / PDF</button></div></div>";
  }
  function dashboard(){
    var c=counts(), total=c.noPrazo+c.atrasados, pct=total?Math.round(c.noPrazo*100/total):0;
    var techs=unique("MONTADOS","TECNICO").slice(0,10);
    var max=1; techs.forEach(function(t){max=Math.max(max,rows("MONTADOS").filter(function(r){return String(r.TECNICO||"")===t;}).length);});
    var bars=techs.map(function(t){
      var n=rows("MONTADOS").filter(function(r){return String(r.TECNICO||"")===t;}).length;
      return "<div class=\"bar\"><span>"+esc(t)+"</span><i><b style=\"width:"+Math.round(n*100/max)+"%\"></b></i><strong>"+n+"</strong></div>";
    }).join("") || "<div class=\"empty\">Sem dados. Importe o backup da planilha.</div>";
    return top("Dashboard","Visão operacional consolidada da oficina.")+
      "<div class=\"cards\">"+
      kpi("Montados",c.montados,"registros","blue")+kpi("No prazo",c.noPrazo,pct+"% dos montados","green")+
      kpi("Atrasados",c.atrasados,"pela data final","red")+kpi("Enrolador",c.enrolador,"registros","orange")+
      kpi("Aprovados",c.aprovados,c.aprovadosOk+" OK / "+c.aprovadosRep+" REP","purple")+kpi("Erros",c.erros,"apontamentos","red")+
      "</div><div class=\"grid2\"><section class=\"card\"><h3>Produção por técnico</h3>"+bars+"</section>"+
      "<section class=\"card center\"><h3>Status de prazo</h3><div class=\"donut\" style=\"--p:"+pct+"%\"><b>"+pct+"%</b><span>no prazo</span></div><p>"+c.noPrazo+" no prazo · "+c.atrasados+" atrasados</p></section></div>";
  }
  function kpi(a,b,c,kind){return "<div class=\"card kpi "+kind+"\"><span>"+esc(a)+"</span><strong>"+esc(b)+"</strong><small>"+esc(c)+"</small></div>";}
  function table(list,cols,withBase){
    if(!list.length)return "<div class=\"empty\">Nenhum registro encontrado.</div>";
    var h=withBase?["BASE"].concat(cols):cols.slice();
    var body=list.map(function(r,idx){
      var html=h.map(function(c){
        var v=c==="BASE"?SHEETS[r.__sheet].label:r[c];
        if(c==="STATUS")return "<td>"+pill(v)+"</td>";
        if(SHEETS[state.sheet]&&SHEETS[state.sheet].dates.indexOf(c)>=0)return "<td>"+esc(dateBR(v))+"</td>";
        return "<td>"+esc(v)+"</td>";
      }).join("");
      if(!withBase)html+="<td class=\"act\"><button class=\"btn small\" data-edit=\""+idx+"\">Editar</button><button class=\"btn small danger\" data-del=\""+idx+"\">Excluir</button></td>";
      return "<tr>"+html+"</tr>";
    }).join("");
    return "<div class=\"table-wrap\"><table><thead><tr>"+h.map(function(c){return "<th>"+esc(c)+"</th>";}).join("")+(withBase?"":"<th>Ações</th>")+"</tr></thead><tbody>"+body+"</tbody></table></div>";
  }
  function dataView(){
    var s=state.sheet, spec=SHEETS[s], list=currentRows(), pages=Math.max(1,Math.ceil(list.length/25));
    if(state.page>pages)state.page=pages;
    var start=(state.page-1)*25, shown=list.slice(start,start+25);
    var tabs=Object.keys(SHEETS).map(function(x){return "<button class=\"tab "+(x===s?"active":"")+"\" data-sheet=\""+esc(x)+"\">"+esc(SHEETS[x].label)+" · "+rows(x).length+"</button>";}).join("");
    var stat=spec.status?"<select class=\"input\" data-filter-status><option value=\"\">Todos os status</option>"+unique(s,"STATUS").map(function(x){return "<option "+(state.status===x?"selected":"")+">"+esc(x)+"</option>";}).join("")+"</select>":"";
    return top("Bases de dados","Edite, inclua, pesquise e exporte os registros.")+
      "<div class=\"tabs\">"+tabs+"</div><section class=\"card tableCard\"><div class=\"toolbar\"><input class=\"input search\" data-search placeholder=\"Pesquisar...\" value=\""+esc(state.search)+"\">"+stat+
      "<button class=\"btn small\" data-act=\"status\">Atualizar status</button><button class=\"btn small\" data-act=\"csv\">Importar CSV</button><button class=\"btn small\" data-act=\"export\">Exportar CSV</button><button class=\"btn small primary\" data-act=\"new\">+ Novo</button></div>"+
      table(shown,spec.cols,false)+"<div class=\"pager\"><span>"+(list.length?start+1:0)+"-"+Math.min(start+25,list.length)+" de "+list.length+"</span><span><button class=\"btn small\" data-page=\"prev\" "+(state.page<=1?"disabled":"")+">Anterior</button><button class=\"btn small\" data-page=\"next\" "+(state.page>=pages?"disabled":"")+">Próximo</button></span></div></section>";
  }
  function prodView(){
    var techs=Array.from(new Set(Object.keys(SHEETS).reduce(function(a,s){return a.concat(unique(s,"TECNICO"));},[]))).sort(function(a,b){return a.localeCompare(b,"pt-BR");});
    var list=productivityRows(), cols=state.prod.sheet==="TODAS"?["O.S","DATA","CLIENTE","TECNICO","DATA FINAL","STATUS","COR","POTÊNCIA","ERRO","QUEM CAUSOU"]:SHEETS[state.prod.sheet].cols;
    return top("Filtragem de produtividade","Consulte por técnico, período e base.")+
      "<section class=\"card\"><div class=\"filters\"><label>Técnico<select class=\"input\" data-p=\"tech\"><option value=\"\">Todos</option>"+techs.map(function(t){return "<option "+(state.prod.tech===t?"selected":"")+">"+esc(t)+"</option>";}).join("")+"</select></label>"+
      "<label>De<input class=\"input\" type=\"date\" data-p=\"from\" value=\""+esc(state.prod.from)+"\"></label><label>Até<input class=\"input\" type=\"date\" data-p=\"to\" value=\""+esc(state.prod.to)+"\"></label>"+
      "<label>Base<select class=\"input\" data-p=\"sheet\"><option value=\"TODAS\">Todas</option>"+Object.keys(SHEETS).map(function(s){return "<option value=\""+esc(s)+"\" "+(state.prod.sheet===s?"selected":"")+">"+esc(SHEETS[s].label)+"</option>";}).join("")+"</select></label>"+
      "<label class=\"grow\">Buscar<input class=\"input\" data-p=\"search\" value=\""+esc(state.prod.search)+"\" placeholder=\"O.S., cliente, erro...\"></label>"+
      "</div><div class=\"summary\"><b>"+list.length+"</b> resultados <button class=\"btn small\" data-act=\"clearprod\">Limpar</button><button class=\"btn small primary\" data-act=\"prodexport\">Exportar CSV</button></div>"+
      table(list.slice(0,500),cols,true)+"</section>";
  }
  function errorsView(){
    state.sheet="ERROS APONTAMENTO";
    return top("Erros de apontamento","Acompanhe falhas de apontamento e responsáveis.")+
      "<section class=\"card tableCard\"><div class=\"toolbar\"><input class=\"input search\" data-search placeholder=\"Pesquisar erro, O.S. ou responsável...\" value=\""+esc(state.search)+"\"><button class=\"btn small primary\" data-act=\"new\">+ Novo</button><button class=\"btn small\" data-act=\"export\">Exportar CSV</button></div>"+table(currentRows().slice(0,500),SHEETS[state.sheet].cols,false)+"</section>";
  }
  function backupView(){
    return top("Backup / dados","Transporte a base sem depender do Excel.")+
      "<div class=\"grid2\"><section class=\"card\"><h3>Backup JSON</h3><p>Exporte todas as cinco bases e restaure-as em outro navegador.</p><button class=\"btn primary\" data-act=\"backup\">Exportar backup</button><button class=\"btn\" data-act=\"importjson\">Restaurar backup</button></section>"+
      "<section class=\"card\"><h3>Importar PDF</h3><p>Leitura de texto do PDF diretamente no navegador e conferência antes do lançamento.</p><button class=\"btn\" data-act=\"pdf\">Selecionar PDF</button><p class=\"note\">PDFs digitalizados ou manuscritos ainda exigem conferência manual.</p></section></div>";
  }
  function render(){
    document.getElementById("app").innerHTML="<div class=\"shell\">"+nav()+"<main>"+(state.view==="dashboard"?dashboard():state.view==="produtividade"?prodView():state.view==="dados"?dataView():state.view==="erros"?errorsView():backupView())+"</main></div>";
    bind();
  }
  function openModal(title,body,foot){
    document.getElementById("modalRoot").innerHTML="<div class=\"modalBg\" id=\"modal\"><div class=\"modal\"><header><b>"+esc(title)+"</b><button data-act=\"close\">×</button></header><div class=\"modalBody\">"+body+"</div><footer>"+foot+"</footer></div></div>";
    bind();
  }
  function formFor(s,idx){
    var spec=SHEETS[s], old=idx==null?{}:rows(s)[idx], body="<div class=\"formGrid\">";
    spec.cols.forEach(function(c){
      var v=old && old[c]!=null?old[c]:"";
      body+="<label>"+esc(c)+"<input class=\"input\" data-f=\""+esc(c)+"\" "+(spec.dates.indexOf(c)>=0?"type=\"date\"":"")+" value=\""+esc(spec.dates.indexOf(c)>=0?dateNorm(v):v)+"\"></label>";
    });
    body+="</div>"+(s==="MONTADOS"?"<p class=\"note\">STATUS é recalculado automaticamente por DATA e DATA FINAL.</p>":"");
    openModal((idx==null?"Novo":"Editar")+" · "+SHEETS[s].label,body,"<button class=\"btn\" data-act=\"close\">Cancelar</button><button class=\"btn primary\" data-save=\""+esc(s)+"\" data-idx=\""+(idx==null?"":idx)+"\">Salvar</button>");
  }
  function saveForm(s,idx){
    var x={}, spec=SHEETS[s];
    spec.cols.forEach(function(c){
      var e=document.querySelector("[data-f=\""+CSS.escape(c)+"\"]"), v=e?e.value:"";
      x[c]=spec.dates.indexOf(c)>=0?dateNorm(v):v;
      if(c==="O.S" && /^\\d+$/.test(String(v).trim()))x[c]=Number(v);
    });
    if(s==="MONTADOS")x.STATUS=status(x);
    if(idx==="")rows(s).push(x);else rows(s)[Number(idx)]=x;
    save(); closeModal(); render();
  }
  function closeModal(){var m=document.getElementById("modal");if(m)m.remove();}
  function del(s,idx){
    var list=currentRows(), target=list[Number(idx)];
    if(!target)return;
    var real=rows(s).indexOf(target);
    if(real>=0 && confirm("Excluir o registro selecionado?")){rows(s).splice(real,1);save();render();}
  }
  function bind(){
    document.querySelectorAll("[data-nav]").forEach(function(b){b.onclick=function(){state.view=b.dataset.nav;state.page=1;render();};});
    document.querySelectorAll("[data-sheet]").forEach(function(b){b.onclick=function(){state.sheet=b.dataset.sheet;state.search="";state.status="";state.page=1;render();};});
    document.querySelectorAll("[data-search]").forEach(function(e){e.oninput=function(){state.search=e.value;state.page=1;render();};});
    document.querySelectorAll("[data-filter-status]").forEach(function(e){e.onchange=function(){state.status=e.value;state.page=1;render();};});
    document.querySelectorAll("[data-page]").forEach(function(b){b.onclick=function(){state.page+=b.dataset.page==="next"?1:-1;render();};});
    document.querySelectorAll("[data-edit]").forEach(function(b){b.onclick=function(){formFor(state.sheet,Number(b.dataset.edit));};});
    document.querySelectorAll("[data-del]").forEach(function(b){b.onclick=function(){del(state.sheet,Number(b.dataset.del));};});
    document.querySelectorAll("[data-p]").forEach(function(e){e.oninput=function(){state.prod[e.dataset.p]=e.value;render();};});
    document.querySelectorAll("[data-act]").forEach(function(b){b.onclick=function(){act(b.dataset.act);};});
    document.querySelectorAll("[data-save]").forEach(function(b){b.onclick=function(){saveForm(b.dataset.save,b.dataset.idx);};});
    var fc=document.getElementById("fileCsv"); if(fc)fc.onchange=function(){var f=fc.files[0];if(f)f.text().then(function(t){try{importCSV(t,state.sheet);}catch(e){alert(e.message);}});fc.value="";};
    var fj=document.getElementById("fileJson"); if(fj)fj.onchange=function(){var f=fj.files[0];if(f)f.text().then(function(t){try{var x=JSON.parse(t);Object.keys(SHEETS).forEach(function(k){if(!Array.isArray(x[k]))throw new Error("Backup incompatível.");});state.data=x;save();render();}catch(e){alert(e.message);}});fj.value="";};
    var fp=document.getElementById("filePdf"); if(fp)fp.onchange=function(){var f=fp.files[0];if(f)readPDF(f);fp.value="";};
  }
  function act(a){
    if(a==="new")formFor(state.sheet,null);
    else if(a==="close")closeModal();
    else if(a==="status")persistStatuses();
    else if(a==="csv")document.getElementById("fileCsv").click();
    else if(a==="export")exportSheet(state.sheet);
    else if(a==="backup")exportBackup();
    else if(a==="importjson")document.getElementById("fileJson").click();
    else if(a==="pdf")document.getElementById("filePdf").click();
    else if(a==="print")setTimeout(function(){window.print();},50);
    else if(a==="clearprod"){state.prod={tech:"",from:"",to:"",sheet:"TODAS",search:""};render();}
    else if(a==="prodexport"){
      var list=productivityRows(), cols=state.prod.sheet==="TODAS"?["O.S","DATA","CLIENTE","TECNICO","DATA FINAL","STATUS","COR","POTÊNCIA","ERRO","QUEM CAUSOU"]:SHEETS[state.prod.sheet].cols;
      var out=[["BASE"].concat(cols).join(";")];
      list.forEach(function(r){out.push([SHEETS[r.__sheet].label].concat(cols.map(function(c){return csv(r[c]);})).join(";"));});
      download("filtragem-de-produtividade.csv","\\uFEFF"+out.join("\n"),"text/csv;charset=utf-8");
    }
  }
  function readPDF(file){
    var script=document.createElement("script");
    script.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload=function(){
      window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      file.arrayBuffer().then(function(buf){return window.pdfjsLib.getDocument({data:buf}).promise;}).then(function(pdf){
        var jobs=[];for(var p=1;p<=pdf.numPages;p++)jobs.push(pdf.getPage(p).then(function(pg){return pg.getTextContent();}));
        return Promise.all(jobs).then(function(pages){return pages.map(function(c){return c.items.map(function(i){return i.str;}).join(" ");}).join("\n");});
      }).then(function(text){
        var m=function(re){var x=text.match(re);return x?x[1].trim():"";};
        var fields={
          "O.S":m(/(?:O\\.?S\\.?|ORDEM\\s+DE\\s+SERVIÇO)\\s*[:#-]?\\s*(\\d{5,7})/i),
          "CLIENTE":m(/CLIENTE\\s*[:\\-]?\\s*([A-ZÀ-Ú0-9 .&/-]{3,80})/i),
          "POTÊNCIA":m(/POT[ÊE]NCIA\\s*[:\\-]?\\s*([A-ZÀ-Ú0-9 .,/.-]{1,30})/i),
          "DATA":m(/DATA\\s*[:\\-]?\\s*(\\d{2}[\\/.-]\\d{2}[\\/.-]\\d{4})/i),
          "DATA FINAL":m(/(?:ENTREGA|PREVIS[ÃA]O\\s+DE\\s+ENTREGA)\\s*[:\\-]?\\s*(\\d{2}[\\/.-]\\d{2}[\\/.-]\\d{4})/i),
          "TECNICO":m(/(?:COLABORADOR|T[ÉE]CNICO)\\s*[:\\-]?\\s*([A-ZÀ-Ú .'-]{2,60})/i)
        };
        var body="<div class=\"formGrid\">";
        Object.keys(fields).forEach(function(k){body+="<label>"+esc(k)+"<input class=\"input\" data-pdf=\""+esc(k)+"\" value=\""+esc(fields[k])+"\"></label>";});
        body+="</div><p class=\"note\">Confira os campos antes de gravar.</p>";
        openModal("Importar relatório PDF",body,"<button class=\"btn\" data-act=\"close\">Cancelar</button><button class=\"btn primary\" data-act=\"savepdf\">Lançar em MONTADOS</button>");
        document.querySelector("[data-act='savepdf']").onclick=function(){savePDF();};
      }).catch(function(e){alert("Não foi possível ler o PDF: "+e.message);});
    };
    script.onerror=function(){alert("A biblioteca PDF.js não pôde ser carregada.");};
    document.head.appendChild(script);
  }
  function savePDF(){
    var x={}, els=document.querySelectorAll("[data-pdf]");els.forEach(function(e){x[e.dataset.pdf]=e.value;});
    state.data.MONTADOS.push({"O.S":x["O.S"],"DATA":dateNorm(x.DATA),"CLIENTE":x.CLIENTE,"TECNICO":x.TECNICO,"DATA FINAL":dateNorm(x["DATA FINAL"]),"STATUS":""});
    state.data.MONTADOS[state.data.MONTADOS.length-1].STATUS=status(state.data.MONTADOS[state.data.MONTADOS.length-1]);
    save();closeModal();state.view="dados";state.sheet="MONTADOS";render();
  }
  render();
})();
