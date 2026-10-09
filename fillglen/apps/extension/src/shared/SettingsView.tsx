export interface SettingsViewProps {
  onBack: () => void;
  lastAnalysis?: string;
}

export function SettingsView({ onBack, lastAnalysis }: SettingsViewProps) {
  return (
    <section className="fg-card fg-settings">
      <div className="fg-card-head">
        <strong>Settings</strong>
        <span>How to use this zip</span>
      </div>
      <div className="toolbar fg-actions">
        <button onClick={onBack}>Back</button>
      </div>

      <h2 className="fg-settings-h">Load the zip in Chrome</h2>
      <ol className="fg-settings-ol">
        <li>Download <code>fillglen-assistant.zip</code> and unzip it.</li>
        <li>Open <code>chrome://extensions</code> and turn on Developer mode.</li>
        <li>Click <strong>Load unpacked</strong> and pick the unzipped <code>fillglen-assistant</code> folder.</li>
        <li>Pin Fillglen. Click the icon to open this window.</li>
      </ol>

      <h2 className="fg-settings-h">What each piece does</h2>
      <ul className="fg-settings-ul">
        <li>
          <strong>Start auto bot</strong> — fills the open application from your resume, submits when required
          fields are done, then opens the next listing. Runs while Chrome is open.
        </li>
        <li>
          <strong>Pause auto bot</strong> — stops filling and submitting immediately.
        </li>
        <li>
          <strong>Resume</strong> — paste text or upload PDF/DOCX. Parse once so name, email, phone, and zip
          are saved.
        </li>
        <li>
          <strong>Live jobs</strong> — listings Fillglen found and ranked to this resume.
        </li>
        <li>
          <strong>Database</strong> — search jobs, employers, and past applies stored in this extension.
        </li>
        <li>
          <strong>Bot ON chip</strong> — small on-page marker while the bot runs. Junk fields stay hidden.
        </li>
      </ul>

      <h2 className="fg-settings-h">How the bot reads a page</h2>
      <p className="meta">
        Before it types or clicks, Fillglen scans the URL, board (Workday, Greenhouse, …), visible fields,
        auth walls, file inputs, Next/Submit, and CAPTCHA. It then picks one fast action: wait, sign up,
        fill, advance, submit, or skip. It does not fill progress scrubbers or unlabeled chrome.
      </p>
      {lastAnalysis ? <p className="banner done">Last page read: {lastAnalysis}</p> : null}

      <h2 className="fg-settings-h">Rules it always keeps</h2>
      <ul className="fg-settings-ul">
        <li>Uses only your resume and the profile fields you typed.</li>
        <li>
          Resume/CV: finds your resume in the uploaded PDF/DOCX, the paste box, or the saved library, clicks
          Attach or Enter manually, and pastes that same file. It does not open Dropbox or Google Drive.
        </li>
        <li>Live jobs prefers multi-step Workday / enterprise applications and stronger titles over basic one-pagers.</li>
        <li>Opens dropdowns and clicks the matching option — it does not type into menus.</li>
        <li>A CAPTCHA waits for you. Fillglen never solves it.</li>
        <li>LinkedIn Easy Apply is blocked.</li>
        <li>Country defaults to United States. Zip defaults to 75006 if you leave it blank.</li>
        <li>Workday “Use last application” only after a real submit at that same company.</li>
        <li>It does not open the next listing until this application is submitted and confirmed.</li>
      </ul>

      <p className="meta">
        The bot fills one dropdown at a time: click to open, click the matching choice, then move on.
        It yields between fields so the tab does not freeze, waits for submit confirmation, then
        switches to the next job.
      </p>
    </section>
  );
}
