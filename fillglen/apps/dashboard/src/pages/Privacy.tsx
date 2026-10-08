export default function Privacy() {
  return (
    <article className="prose max-w-2xl space-y-3">
      <h1 className="text-2xl">Fillglen privacy policy</h1>
      <p>Last updated 8 October 2026.</p>
      <p>
        Fillglen is a job-application assistant. It stores the profile, answers, and application records you provide so
        it can fill forms on supported boards. It does not sell or share that data. It does not run on LinkedIn Easy
        Apply.
      </p>
      <h2 className="text-xl">What we collect</h2>
      <ul className="list-disc pl-5">
        <li>Account email, if you sign in.</li>
        <li>Resume text, structured profile fields, and saved answers you enter.</li>
        <li>Self-identification answers, defaulting to Decline, encrypted at rest.</li>
        <li>Copies of job descriptions and answers sent, for your tracker.</li>
        <li>Optional anonymous fill-success counts per board, only with consent, never the answers themselves.</li>
      </ul>
      <h2 className="text-xl">How it is used</h2>
      <p>
        Data is used to fill forms you open, draft answers you approve, tailor resumes from facts you listed, and show
        your tracker. AI requests go to our server. The extension never holds a model API key. Chrome Web Store user
        data policy applies: personal data is not used for unrelated advertising.
      </p>
      <h2 className="text-xl">What we never do</h2>
      <ul className="list-disc pl-5">
        <li>Click the final Submit button.</li>
        <li>Invent jobs, skills, or credentials.</li>
        <li>Load remote executable code into the extension.</li>
        <li>Scrape LinkedIn or Indeed.</li>
      </ul>
      <h2 className="text-xl">Your controls</h2>
      <p>Export everything or delete your account in Settings. Pause live filling per site from the live window.</p>
    </article>
  );
}
