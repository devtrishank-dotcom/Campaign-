import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { publicBase } from "../lib/api";
import { useToast } from "../lib/toast";
import { Spinner, StatusBadge, Empty } from "../components/ui";
import Icon from "../components/Icon";

const TYPES = [
  { v: "single", l: "Single choice" },
  { v: "multiple", l: "Multiple choice" },
  { v: "yesno", l: "Yes / No" },
  { v: "rating", l: "Rating (1-5)" },
  { v: "text", l: "Text" },
];

const newQuestion = () => ({ label: "", type: "single", options: [""], required: false });

export default function SurveyDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [tab, setTab] = useState("build");
  const [survey, setSurvey] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/surveys/${id}`);
      setSurvey(data.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const loadResults = async () => {
    try {
      const { data } = await api.get(`/surveys/${id}/results`);
      setResults(data);
    } catch (e) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    if (tab === "results") loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const set = (patch) => setSurvey((s) => ({ ...s, ...patch }));

  const updateQuestion = (idx, patch) => {
    setSurvey((s) => {
      const questions = [...s.questions];
      questions[idx] = { ...questions[idx], ...patch };
      return { ...s, questions };
    });
  };

  const addQuestion = () => set({ questions: [...survey.questions, newQuestion()] });
  const removeQuestion = (idx) =>
    set({ questions: survey.questions.filter((_, i) => i !== idx) });
  const moveQuestion = (idx, dir) => {
    const questions = [...survey.questions];
    const target = idx + dir;
    if (target < 0 || target >= questions.length) return;
    [questions[idx], questions[target]] = [questions[target], questions[idx]];
    set({ questions });
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        title: survey.title,
        description: survey.description,
        thankYouMessage: survey.thankYouMessage,
        status: survey.status,
        questions: survey.questions.map((q) => ({
          label: q.label,
          type: q.type,
          required: q.required,
          options: ["single", "multiple"].includes(q.type) ? q.options.filter((o) => o.trim()) : [],
        })),
      };
      await api.put(`/surveys/${id}`, payload);
      toast.success("Survey saved");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status) => {
    try {
      await api.put(`/surveys/${id}`, { status });
      set({ status });
      toast.success(`Survey ${status}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <Spinner />;
  if (!survey) return <div className="alert err">Survey not found</div>;

  const publicUrl = `${publicBase()}/s/${survey.slug}`;

  return (
    <div>
      <div className="toolbar">
        <Link to="/surveys" className="btn secondary sm">
          <Icon name="arrowLeft" size={14} /> Back
        </Link>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{survey.title}</div>
        <StatusBadge status={survey.status} />
        <div className="spacer" />
        {survey.status !== "active" ? (
          <button className="btn" onClick={() => setStatus("active")}>
            Activate
          </button>
        ) : (
          <button className="btn secondary" onClick={() => setStatus("closed")}>
            Close
          </button>
        )}
        <button
          className="btn secondary"
          onClick={() => {
            navigator.clipboard?.writeText(publicUrl);
            toast.success("Link copied");
          }}
        >
          <Icon name="link" size={14} /> Copy public link
        </button>
        <a className="btn secondary" href={publicUrl} target="_blank" rel="noreferrer">
          Open
        </a>
      </div>

      <div className="chips" style={{ marginBottom: 16 }}>
        <span className={`chip ${tab === "build" ? "on" : ""}`} onClick={() => setTab("build")}>
          <Icon name="edit" size={13} /> Build
        </span>
        <span className={`chip ${tab === "results" ? "on" : ""}`} onClick={() => setTab("results")}>
          <Icon name="chart" size={13} /> Results ({survey.responseCount || 0})
        </span>
      </div>

      {tab === "build" && (
        <div>
          <div className="card pad" style={{ marginBottom: 16 }}>
            <div className="row">
              <div className="field">
                <label>Title</label>
                <input value={survey.title} onChange={(e) => set({ title: e.target.value })} />
              </div>
              <div className="field">
                <label>Public slug</label>
                <input value={survey.slug} onChange={(e) => set({ slug: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Description</label>
              <textarea rows={2} value={survey.description || ""} onChange={(e) => set({ description: e.target.value })} />
            </div>
            <div className="field">
              <label>Thank you message</label>
              <input
                value={survey.thankYouMessage || ""}
                onChange={(e) => set({ thankYouMessage: e.target.value })}
              />
            </div>
          </div>

          {survey.questions.map((q, idx) => (
            <div className="card pad" key={idx} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <b>Question {idx + 1}</b>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn ghost sm" onClick={() => moveQuestion(idx, -1)}>
                    <Icon name="arrowUp" size={14} />
                  </button>
                  <button className="btn ghost sm" onClick={() => moveQuestion(idx, 1)}>
                    <Icon name="arrowDown" size={14} />
                  </button>
                  <button className="btn ghost sm" style={{ color: "var(--red)" }} onClick={() => removeQuestion(idx)}>
                    Remove
                  </button>
                </div>
              </div>
              <div className="row">
                <div className="field" style={{ flex: 2 }}>
                  <label>Question</label>
                  <input
                    value={q.label}
                    onChange={(e) => updateQuestion(idx, { label: e.target.value })}
                    placeholder="Who will you vote for?"
                  />
                </div>
                <div className="field">
                  <label>Type</label>
                  <select value={q.type} onChange={(e) => updateQuestion(idx, { type: e.target.value })}>
                    {TYPES.map((t) => (
                      <option key={t.v} value={t.v}>
                        {t.l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {["single", "multiple"].includes(q.type) && (
                <div className="field">
                  <label>Options</label>
                  {q.options.map((o, oi) => (
                    <div key={oi} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <input
                        value={o}
                        onChange={(e) => {
                          const options = [...q.options];
                          options[oi] = e.target.value;
                          updateQuestion(idx, { options });
                        }}
                        placeholder={`Option ${oi + 1}`}
                      />
                      <button
                        className="btn ghost sm"
                        onClick={() => updateQuestion(idx, { options: q.options.filter((_, i) => i !== oi) })}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn secondary sm"
                    onClick={() => updateQuestion(idx, { options: [...q.options, ""] })}
                  >
                    <Icon name="plus" size={14} /> Add option
                  </button>
                </div>
              )}

              <label className="check">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => updateQuestion(idx, { required: e.target.checked })}
                />
                Required
              </label>
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn secondary" onClick={addQuestion}>
              <Icon name="plus" size={15} /> Add Question
            </button>
            <button className="btn" onClick={save} disabled={busy}>
              {busy ? "Saving..." : "Save Survey"}
            </button>
          </div>
        </div>
      )}

      {tab === "results" && (
        <div>
          {!results ? (
            <Spinner />
          ) : results.totalResponses === 0 ? (
            <div className="card">
              <Empty icon="chart" title="No responses yet">
                Share the public link or send a campaign with this survey attached.
              </Empty>
            </div>
          ) : (
            <>
              <div className="card pad" style={{ marginBottom: 16 }}>
                <h3 style={{ marginTop: 0 }}>Summary ({results.totalResponses} responses)</h3>
                {results.summary.map((q) => {
                  const max = Math.max(1, ...Object.values(q.counts));
                  return (
                    <div key={q.questionId} style={{ marginBottom: 18 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>{q.label}</div>
                      {Object.keys(q.counts).length === 0 ? (
                        <div className="muted small">No answers</div>
                      ) : (
                        Object.entries(q.counts)
                          .sort((a, b) => b[1] - a[1])
                          .map(([opt, cnt]) => (
                            <div className="bar-row" key={opt}>
                              <div className="bar-label">{opt}</div>
                              <div className="bar-track">
                                <div className="bar-fill" style={{ width: `${(cnt / max) * 100}%` }} />
                              </div>
                              <div className="bar-val">{cnt}</div>
                            </div>
                          ))
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="card">
                <div className="card-head">
                  <h3>Responses</h3>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Contact</th>
                        {results.survey.questions.map((q) => (
                          <th key={q._id}>{q.label}</th>
                        ))}
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.responses.map((r) => (
                        <tr key={r._id}>
                          <td style={{ fontWeight: 600 }}>
                            {r.contact?.name || r.contact?.email || r.contact?.phone || "Anonymous"}
                          </td>
                          {results.survey.questions.map((q) => {
                            const a = r.answers.find((x) => String(x.questionId) === String(q._id));
                            return <td key={q._id}>{a ? (Array.isArray(a.value) ? a.value.join(", ") : String(a.value)) : "—"}</td>;
                          })}
                          <td className="small muted">{new Date(r.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
