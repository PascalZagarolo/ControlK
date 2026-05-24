import type { Metadata } from 'next';
import { LegalShell } from '../_components/LegalShell';

export const metadata: Metadata = {
  title: 'Impressum — Ctrl K',
  description: 'Anbieterkennzeichnung gemäß § 5 TMG.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/impressum' },
};

export default function ImpressumPage() {
  return (
    <LegalShell kicker="Rechtliches" title="Impressum">
      {/* Template auf Basis Standard § 5 TMG. Vor Launch mit Bezahlfunktion
          oder hohem Traffic durch Generator (eRecht24) oder Anwalt
          gegenprüfen. */}
      <h2>Angaben gemäß § 5 TMG</h2>

      <p>
        Pascal Zagarolo
        <br />
        Bozenerstraße 26
        <br />
        42659 Solingen
        <br />
        Deutschland
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href="mailto:hello@ctrlk.de">hello@ctrlk.de</a>
      </p>

      <h2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
      <p>Pascal Zagarolo, Anschrift wie oben.</p>

      <h2>Haftungsausschluss</h2>

      <h3>Haftung für Inhalte</h3>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte
        auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§
        8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet,
        übermittelte oder gespeicherte fremde Informationen zu überwachen oder
        nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit
        hinweisen.
      </p>
      <p>
        Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen
        nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine
        diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis
        einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von
        entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend
        entfernen.
      </p>

      <h3>Haftung für Links</h3>
      <p>
        Unser Angebot enthält Links zu externen Websites Dritter, auf deren
        Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden
        Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten
        Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten
        verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der
        Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige
        Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.
      </p>

      <h3>Urheberrecht</h3>
      <p>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen
        Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung,
        Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
        Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des
        jeweiligen Autors bzw. Erstellers.
      </p>

      <h2>Online-Streitbeilegung</h2>
      <p>
        Die EU-Kommission stellt eine Plattform zur Online-Streitbeilegung
        (OS) bereit:{' '}
        <a href="https://ec.europa.eu/consumers/odr" rel="noopener noreferrer" target="_blank">
          ec.europa.eu/consumers/odr
        </a>
        . Zur Teilnahme an einem Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle sind wir nicht verpflichtet und nicht
        bereit.
      </p>
    </LegalShell>
  );
}
