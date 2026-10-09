import { useEffect, useState } from "react";
import { api, token } from "../api";
import { usePersistedState } from "../persist";

export default function Answers() {
  const [items, setItems] = useState<any[]>([]);
  const [pattern, setPattern] = usePersistedState("answers-pattern", "");
  const [answer, setAnswer] = usePersistedState("answers-draft", "");
  async function refresh() {
    if (token()) setItems(await api("/v1/answers"));
  }
  useEffect(() => {
    refresh();
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Answer library</h1>
      <form
        className="grid gap-2 max-w-xl"
        onSubmit={async (e) => {
          e.preventDefault();
          await api("/v1/answers", { method: "POST", body: JSON.stringify({ pattern, answer }) });
          setPattern("");
          setAnswer("");
          refresh();
        }}
      >
        <input placeholder="Question pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} />
        <textarea placeholder="Your exact answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <button className="bg-pine text-cream px-3 py-2 rounded-lg w-fit">Save</button>
      </form>
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="border rounded-xl p-3 flex justify-between gap-3">
            <div>
              <strong>{a.pattern}</strong>
              <p className="text-sm">{a.answer}</p>
            </div>
            <button
              onClick={async () => {
                await api(`/v1/answers/${a.id}`, { method: "DELETE" });
                refresh();
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
