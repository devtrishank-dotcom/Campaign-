import { Survey } from "../models/Survey.js";

// Self-contained public survey page so links work without the SPA
export function surveyPage(req, res) {
  const slug = String(req.params.slug || "").replace(/[^a-z0-9-]/gi, "");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Survey</title>
<style>
  :root{--brand:#4f46e5;--bg:#f1f5f9;--card:#fff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);padding:16px}
  .wrap{max-width:640px;margin:24px auto}
  .card{background:var(--card);border-radius:14px;box-shadow:0 10px 40px rgba(2,6,23,.08);padding:28px}
  h1{margin:0 0 6px;font-size:22px}
  .desc{color:var(--muted);margin:0 0 20px;font-size:14px;line-height:1.5}
  .q{margin:0 0 20px;padding-bottom:18px;border-bottom:1px solid var(--border)}
  .q:last-of-type{border-bottom:none}
  .q label.qlabel{display:block;font-weight:600;margin-bottom:10px;font-size:15px}
  .req{color:#dc2626;margin-left:4px}
  .opt{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;cursor:pointer;transition:.15s}
  .opt:hover{border-color:var(--brand);background:#f8faff}
  .opt input{accent-color:var(--brand);width:18px;height:18px}
  textarea,input[type=text]{width:100%;padding:11px 12px;border:1px solid var(--border);border-radius:10px;font:inherit;resize:vertical}
  .stars{display:flex;gap:8px}
  .stars button{font-size:26px;background:none;border:none;cursor:pointer;color:#cbd5e1;transition:.15s}
  .stars button.on{color:#f59e0b}
  button.submit{margin-top:8px;width:100%;padding:13px;border:none;border-radius:10px;background:var(--brand);color:#fff;font-size:16px;font-weight:600;cursor:pointer}
  button.submit:disabled{opacity:.6;cursor:not-allowed}
  .msg{padding:14px;border-radius:10px;margin-bottom:14px;font-size:14px}
  .msg.err{background:#fef2f2;color:#b91c1c}
  .msg.ok{background:#f0fdf4;color:#15803d}
  .center{text-align:center}
  .spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--brand);border-radius:50%;animation:s .8s linear infinite;margin:40px auto}
  @keyframes s{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="wrap"><div class="card" id="app"><div class="spinner"></div></div></div>
<script>
(function(){
  var SLUG = ${JSON.stringify(slug)};
  var params = new URLSearchParams(location.search);
  var TRACK = params.get('t') || '';
  var API = '/api/public/surveys/' + SLUG;
  var app = document.getElementById('app');
  var survey = null;
  var values = {};

  function esc(s){var d=document.createElement('div');d.textContent=s==null?'':s;return d.innerHTML;}

  function render(){
    var h = '<h1>'+esc(survey.title)+'</h1>';
    if(survey.description) h += '<p class="desc">'+esc(survey.description)+'</p>';
    h += '<div id="msg"></div><form id="f">';
    survey.questions.forEach(function(q,idx){
      h += '<div class="q" data-id="'+q._id+'"><label class="qlabel">'+esc(q.label)+(q.required?'<span class="req">*</span>':'')+'</label>';
      if(q.type==='single'||q.type==='multiple'){
        (q.options||[]).forEach(function(o){
          var inputType = q.type==='single'?'radio':'checkbox';
          h += '<label class="opt"><input type="'+inputType+'" name="q_'+q._id+'" value="'+esc(o)+'"><span>'+esc(o)+'</span></label>';
        });
      } else if(q.type==='yesno'){
        ['Yes','No'].forEach(function(o){
          h += '<label class="opt"><input type="radio" name="q_'+q._id+'" value="'+o+'"><span>'+o+'</span></label>';
        });
      } else if(q.type==='rating'){
        h += '<div class="stars" data-q="'+q._id+'">';
        for(var i=1;i<=5;i++){ h += '<button type="button" data-val="'+i+'">&#9733;</button>'; }
        h += '</div>';
      } else {
        h += '<textarea name="q_'+q._id+'" rows="3" placeholder="Your answer"></textarea>';
      }
      h += '</div>';
    });
    h += '<button type="submit" class="submit">Submit</button></form>';
    app.innerHTML = h;

    app.querySelectorAll('.stars').forEach(function(box){
      var qid = box.getAttribute('data-q');
      box.querySelectorAll('button').forEach(function(btn){
        btn.addEventListener('click', function(){
          values[qid] = Number(btn.getAttribute('data-val'));
          box.querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', Number(b.getAttribute('data-val')) <= values[qid]); });
        });
      });
    });

    document.getElementById('f').addEventListener('submit', submit);
  }

  function showMsg(text, type){
    var m = document.getElementById('msg');
    m.innerHTML = '<div class="msg '+type+'">'+esc(text)+'</div>';
    m.scrollIntoView({behavior:'smooth', block:'center'});
  }

  function submit(e){
    e.preventDefault();
    var answers = [];
    survey.questions.forEach(function(q){
      var val;
      if(q.type==='single'||q.type==='yesno'){
        var el = document.querySelector('input[name="q_'+q._id+'"]:checked');
        val = el ? el.value : '';
      } else if(q.type==='multiple'){
        val = Array.prototype.map.call(document.querySelectorAll('input[name="q_'+q._id+'"]:checked'), function(el){return el.value;});
      } else if(q.type==='rating'){
        val = values[q._id] || '';
      } else {
        var t = document.querySelector('[name="q_'+q._id+'"]');
        val = t ? t.value : '';
      }
      answers.push({ questionId: q._id, value: val });
    });

    var btn = document.querySelector('button.submit');
    btn.disabled = true; btn.textContent = 'Submitting...';

    fetch(API + '/submit', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ answers: answers, trackingId: TRACK })
    })
    .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, body:j}; }); })
    .then(function(res){
      if(res.ok){
        app.innerHTML = '<div class="center"><h1>'+esc(survey.title)+'</h1><p class="desc">'+esc(res.body.message||survey.thankYouMessage||'Thank you!')+'</p></div>';
      } else {
        btn.disabled = false; btn.textContent = 'Submit';
        showMsg(res.body.message || 'Something went wrong', 'err');
      }
    })
    .catch(function(){
      btn.disabled = false; btn.textContent = 'Submit';
      showMsg('Network error, please try again', 'err');
    });
  }

  fetch(API)
    .then(function(r){ return r.json(); })
    .then(function(j){
      if(!j.success){ app.innerHTML = '<div class="center"><h1>Survey unavailable</h1><p class="desc">'+esc(j.message||'')+'</p></div>'; return; }
      survey = j.data; render();
    })
    .catch(function(){ app.innerHTML = '<div class="center"><h1>Survey unavailable</h1><p class="desc">Please try again later.</p></div>'; });
})();
</script>
</body>
</html>`;
  res.set("Content-Type", "text/html");
  res.send(html);
}
