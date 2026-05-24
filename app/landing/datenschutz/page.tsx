import type { Metadata } from 'next';
import { LegalShell } from '../_components/LegalShell';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung — Ctrl K',
  description:
    'Wie wir mit deinen Daten auf ctrlk.de umgehen — DSGVO-konform und kurz gehalten.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/datenschutz' },
};

// Stand: bei jedem inhaltlichen Update auf das aktuelle Datum heben.
const STAND = '28. Mai 2026';

export default function DatenschutzPage() {
  return (
    <LegalShell kicker="Rechtliches" title="Datenschutzerklärung">
      <p className="legal-meta">Stand: {STAND}</p>

      {/* Template auf Basis Standard-DSGVO-Anforderungen. Bei jedem neuen
          Datenverarbeitungs-Kontext (Gmail-Integration, Slack, Teams, …)
          muss dieses Dokument aktualisiert werden. Spätestens bei Launch
          mit Bezahlfunktion durch einen Anwalt prüfen lassen. */}
      <h2>1. Verantwortlicher</h2>
      <p>
        Pascal Zagarolo
        <br />
        Bozenerstraße 26
        <br />
        42659 Solingen, Deutschland
        <br />
        E-Mail: <a href="mailto:hello@ctrlk.de">hello@ctrlk.de</a>
      </p>

      <h2>2. Allgemeine Hinweise</h2>
      <p>
        Diese Datenschutzerklärung klärt dich über Art, Umfang und Zweck der
        Verarbeitung personenbezogener Daten innerhalb der Website{' '}
        <a href="https://ctrlk.de">ctrlk.de</a> auf. Ctrl K ist derzeit eine
        Vor-Launch-Landingpage. Die einzige aktive Datenverarbeitung ist die
        Anmeldung zur Waitlist und das technisch notwendige Server-Logging
        durch unseren Hosting-Anbieter.
      </p>

      <h2>3. Welche Daten verarbeiten wir?</h2>

      <h3>3.1 Beim Besuch der Website (Hosting)</h3>
      <p>
        Beim Aufruf der Website erhebt unser Hosting-Anbieter, die{' '}
        <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133, Walnut, CA 91789, USA,
        automatisch technische Informationen in Server-Logfiles, die dein
        Browser an uns übermittelt:
      </p>
      <ul>
        <li>IP-Adresse (gekürzt / anonymisiert)</li>
        <li>Datum und Uhrzeit des Zugriffs</li>
        <li>Aufgerufene Seite (URL)</li>
        <li>Browser-Typ und Browser-Version</li>
        <li>Betriebssystem</li>
        <li>Referrer-URL (vorher besuchte Seite)</li>
      </ul>
      <p>
        Diese Daten dienen ausschließlich der technischen Sicherheit und der
        Bereitstellung der Website. <strong>Rechtsgrundlage:</strong> Art. 6
        Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb).
      </p>
      <p>
        <strong>Hinweis zur Übermittlung in Drittländer:</strong> Vercel
        verarbeitet Daten in den USA. Mit Vercel bestehen
        Standardvertragsklauseln (SCC) gemäß Art. 46 DSGVO als geeignete
        Garantie für das Schutzniveau.
      </p>

      <h3>3.2 Bei Anmeldung zur Waitlist</h3>
      <p>Wenn du dich für die Waitlist anmeldest, verarbeiten wir:</p>
      <ul>
        <li>deine <strong>E-Mail-Adresse</strong></li>
        <li>den <strong>Zeitpunkt</strong> der Anmeldung und der Bestätigung</li>
        <li>einen <strong>kryptografischen Hash deiner IP-Adresse</strong> (SHA-256-Präfix, nicht zurückrechenbar) ausschließlich zur Spam-Abwehr</li>
        <li>deinen <strong>User-Agent</strong> (Browser-Kennung) zur Missbrauchsabwehr</li>
      </ul>
      <p>
        <strong>Zweck:</strong> Information über den Launch von Ctrl K, Early
        Access, Meilensteine und ein Heads-up vor dem Start. Keine
        Newsletter, kein Tracking.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO
        (Einwilligung). Die Einwilligung erfolgt aktiv durch das Anhaken der
        Checkbox im Formular und wird durch Klick auf den Bestätigungslink
        in einer separaten E-Mail verifiziert (<strong>Double Opt-In</strong>).
      </p>
      <p>
        <strong>Speicherdauer:</strong> Bis zum Widerruf der Einwilligung.
        Unbestätigte Anmeldungen (kein Klick auf den Bestätigungslink innerhalb
        von 7 Tagen) werden ungültig und beim nächsten Anmeldeversuch
        überschrieben. Du kannst deine Einwilligung jederzeit per Nachricht
        an <a href="mailto:hello@ctrlk.de">hello@ctrlk.de</a> widerrufen — dann
        löschen wir deine Daten umgehend.
      </p>

      <h3>3.3 E-Mail-Versand</h3>
      <p>
        Den Versand der Bestätigungs-E-Mail und späterer Updates wickeln wir
        über die <strong>Resend Inc.</strong>, 2261 Market Street #4936, San
        Francisco, CA 94114, USA, ab. Resend erhält dazu deine E-Mail-Adresse,
        Datum und Inhalt der Nachricht. Mit Resend besteht ein
        Auftragsverarbeitungsvertrag (AVV) sowie Standardvertragsklauseln (SCC)
        gemäß Art. 46 DSGVO.
      </p>

      <h3>3.4 Datenbank</h3>
      <p>
        Die Waitlist-Daten liegen in einer{' '}
        <strong>Neon Postgres</strong>-Datenbank (Neon Inc., 209 Havemeyer St
        #5, Brooklyn, NY 11211, USA), bezogen über den Vercel Marketplace.
        Datenverarbeitung erfolgt in der EU-Region Frankfurt (eu-central-1).
        Mit Neon bestehen die im Marketplace hinterlegten AVV und SCC.
      </p>

      <h3>3.5 Login mit Google (OAuth)</h3>
      <p>
        Wenn du dich für „Mit Google anmelden" entscheidest, leiten wir
        dich auf eine Seite der <strong>Google Ireland Limited</strong>,
        Gordon House, Barrow Street, Dublin 4, Irland weiter. Dort
        authentifizierst du dich direkt bei Google. Nach erfolgreicher
        Anmeldung erhalten wir von Google nur die folgenden Daten zu
        deiner Person: stabile Google-Nutzer-ID (sogenannte „sub"),
        deine E-Mail-Adresse, Bestätigungsstatus deiner E-Mail-Adresse,
        deinen angezeigten Namen sowie deinen Profilbild-Link.
      </p>
      <p>
        Diese Daten verwenden wir ausschließlich, um dein Konto zu
        erstellen oder ein bestehendes Konto mit gleicher E-Mail mit
        deiner Google-Identität zu verknüpfen. Beim reinen Login greifen
        wir <strong>nicht</strong> auf deine Gmail-Inhalte, Kontakte,
        Kalender oder andere Google-Dienste zu — der Berechtigungsumfang
        ist auf <code>openid email profile</code> beschränkt.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO
        (Vertragsanbahnung/-erfüllung) und Art. 6 Abs. 1 lit. f DSGVO
        (berechtigtes Interesse an einer bequemen und sicheren
        Anmeldung). Mit Google bestehen Standardvertragsklauseln (SCC)
        gemäß Art. 46 DSGVO für die Übermittlung in die USA, sofern die
        Verarbeitung dort erfolgt.
      </p>
      <p>
        <strong>Speicherdauer:</strong> Die Verknüpfung zu deiner
        Google-Identität bleibt bestehen, solange du dein Konto bei uns
        nutzt. Du kannst die Verknüpfung jederzeit per Nachricht an{' '}
        <a href="mailto:hello@ctrlk.de">hello@ctrlk.de</a> aufheben
        lassen.
      </p>

      <h3>3.6 Gmail-Verbindung (optional)</h3>
      <p>
        Wenn du in den Konto-Einstellungen aktiv <strong>„Mit Gmail
        verbinden"</strong> wählst, erweitern wir den Google-Berechtigungs­umfang
        um <code>https://www.googleapis.com/auth/gmail.readonly</code>.
        Diese Erweiterung ist <strong>nicht</strong> Teil des regulären
        Logins und passiert ausschließlich auf deine explizite Aktion
        hin. Du musst die Erweiterung in einem separaten
        Google-Consent-Dialog bestätigen.
      </p>
      <p>
        Mit der Verbindung verarbeiten wir folgende Daten aus deinem
        Gmail-Postfach:
      </p>
      <ul>
        <li>
          <strong>Metadaten</strong> der letzten ungelesenen Nachrichten
          deines Posteingangs: Absender-Name und -E-Mail, Betreff,
          Empfangszeitpunkt, Gmail-Nachrichten-ID und Thread-ID,
          Lesestatus
        </li>
        <li>
          den von Google generierten <strong>Snippet</strong> (kurzer
          Vorschau-Text der ersten ~150 Zeichen der Nachricht), den
          Google selbst aus deinen Mails ableitet
        </li>
      </ul>
      <p>
        Wir lesen <strong>keine vollständigen Nachrichten-Inhalte und
        keine Anhänge</strong>. Wir holen ausschließlich Metadaten plus
        den von Google bereitgestellten Snippet ab. Die Abfrage läuft
        gegen die Gmail REST API; eine Synchronisation findet alle ~5
        Minuten statt sowie beim Öffnen des Foyers.
      </p>
      <p>
        <strong>Zweck:</strong> Universal-Inbox im Foyer — du siehst
        deine wichtigsten ungelesenen Mails neben Notizen, Kanälen und
        Erwähnungen ohne in Gmail wechseln zu müssen. Wir nutzen die
        Daten nicht zum Profiling, nicht für KI-Training, nicht zur
        Weitergabe an Dritte.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO
        (ausdrückliche Einwilligung durch den Google-Consent + die
        bewusste Aktivierung in den Konto-Einstellungen).
      </p>
      <p>
        <strong>Speicherung:</strong> Die Gmail-OAuth-Tokens (Access-
        und Refresh-Token) liegen <strong>AES-256-GCM-verschlüsselt</strong>{' '}
        in der Datenbank; der Schlüssel liegt in einer separaten
        Umgebungsvariable und nicht in der DB. Die abgerufenen
        Metadaten werden in der `inbox_items`-Tabelle gespeichert und
        bleiben bestehen bis du sie archivierst oder die Verbindung
        trennst.
      </p>
      <p>
        <strong>Widerruf:</strong> Du kannst die Verbindung jederzeit
        in den Konto-Einstellungen unter „Integrationen → Gmail" mit
        einem Klick trennen. Wir rufen dann sofort Google's
        Token-Revoke-Endpoint auf und löschen die Tokens lokal. Die
        bereits gespeicherten Metadaten werden zusätzlich auf Anfrage
        an <a href="mailto:hello@ctrlk.de">hello@ctrlk.de</a> entfernt.
        Unabhängig davon kannst du die Berechtigung auch direkt in den{' '}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google-Konto-Berechtigungen
        </a>{' '}
        widerrufen.
      </p>

      <h3>3.7 Reichweitenmessung (Analytics)</h3>
      <p>
        Wir nutzen <strong>Vercel Analytics</strong>. Vercel Analytics
        funktioniert <strong>cookieless</strong> und verzichtet auf
        personenbezogene Identifikatoren. IP-Adressen werden vor der Auswertung
        gehasht und nicht gespeichert. Es findet kein geräteübergreifendes
        Tracking statt.
      </p>
      <p>
        <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO
        (berechtigtes Interesse an einer datensparsamen statistischen
        Reichweitenmessung). Da keine zugriffsbedingte Speicherung im
        Endgerät (TTDSG § 25) erfolgt, ist keine Einwilligung erforderlich.
      </p>

      <h2>4. Cookies</h2>
      <p>
        Diese Website setzt <strong>keine</strong> Cookies — weder technisch
        notwendige (über das hinaus, was Vercel als Hosting-Plattform
        gegebenenfalls für Sicherheitszwecke setzt) noch Tracking- oder
        Marketing-Cookies. Aus diesem Grund verzichten wir auf einen
        Cookie-Banner.
      </p>

      <h2>5. Empfänger der Daten</h2>
      <p>Personenbezogene Daten werden an folgende Auftragsverarbeiter weitergegeben:</p>
      <ul>
        <li><strong>Vercel Inc.</strong> — Hosting</li>
        <li><strong>Neon Inc.</strong> — Datenbank</li>
        <li><strong>Resend Inc.</strong> — E-Mail-Versand</li>
        <li>
          <strong>Google Ireland Limited</strong> — optional, nur wenn du
          dich für „Mit Google anmelden" oder „Mit Gmail verbinden"
          entscheidest
        </li>
      </ul>
      <p>
        Eine Weitergabe an andere Dritte (Werbenetzwerke, Datenhändler,
        Behörden außerhalb gesetzlicher Pflichten) findet nicht statt.
      </p>

      <h2>6. Deine Rechte</h2>
      <p>Du hast jederzeit das Recht auf:</p>
      <ul>
        <li>Auskunft über deine gespeicherten Daten (Art. 15 DSGVO)</li>
        <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
        <li>Löschung deiner Daten (Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
        <li>Widerruf deiner Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)</li>
        <li>Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
      </ul>
      <p>
        Zur Ausübung deiner Rechte reicht eine formlose E-Mail an{' '}
        <a href="mailto:hello@ctrlk.de">hello@ctrlk.de</a>.
      </p>
      <p>
        Zuständige Aufsichtsbehörde:{' '}
        <strong>
          Landesbeauftragte für Datenschutz und Informationsfreiheit
          Nordrhein-Westfalen (LDI NRW)
        </strong>
        , Kavalleriestraße 2–4, 40213 Düsseldorf,{' '}
        <a
          href="https://www.ldi.nrw.de"
          rel="noopener noreferrer"
          target="_blank"
        >
          ldi.nrw.de
        </a>
        .
      </p>

      <h2>7. Änderungen dieser Erklärung</h2>
      <p>
        Wir behalten uns vor, diese Datenschutzerklärung anzupassen, sobald
        sich die zugrundeliegende Verarbeitung ändert oder neue rechtliche
        Anforderungen entstehen. Die jeweils aktuelle Version findest du
        immer auf dieser Seite.
      </p>
    </LegalShell>
  );
}
