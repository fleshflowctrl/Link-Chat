import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTROLLER_ADDRESS,
  LEGAL_CONTROLLER_NAME,
  LEGAL_KVK,
  LEGAL_LAST_UPDATED,
  LEGAL_PATHS,
  LEGAL_PRIVACY_EMAIL,
  LEGAL_SECURITY_EMAIL,
  LEGAL_SITE_LABEL,
} from "@/lib/legal/constants";
import type { LegalDocument } from "@/lib/legal/types";

export const privacyNl: LegalDocument = {
  title: "Privacyverklaring",
  subtitle: `Privacyverklaring van ${LEGAL_SITE_LABEL}`,
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      id: "art-1",
      title: "1 — Wie zijn wij?",
      paragraphs: [
        `${LEGAL_SITE_LABEL} wordt aangeboden door:`,
        "Wij zijn verantwoordelijk voor de verwerking van persoonsgegevens via het platform.",
        "Als je persoonsgegevens verwerkt van klanten of bezoekers, moet je volgens de AVG een privacyverklaring hebben waarin duidelijk staat wat je met persoonsgegevens doet en waarom.",
      ],
      bullets: [
        `Bedrijfsnaam: ${LEGAL_CONTROLLER_NAME}`,
        `KVK-nummer: ${LEGAL_KVK}`,
        `Adres: ${LEGAL_CONTROLLER_ADDRESS}`,
        `E-mail privacy: ${LEGAL_PRIVACY_EMAIL}`,
        `E-mail support: ${LEGAL_CONTACT_EMAIL}`,
      ],
    },
    {
      id: "art-2",
      title: "2 — Welke persoonsgegevens verwerken wij?",
      paragraphs: ["Wij kunnen de volgende gegevens verwerken:"],
      bullets: [
        "Accountgegevens: naam of gebruikersnaam, e-mailadres, wachtwoordhash, leeftijdsbevestiging, taal, land, accountinstellingen.",
        "Profielgegevens: profielnaam, woonplaats of regio, foto’s, profieltekst, voorkeuren en informatie die je zelf invult.",
        "Chat- en gebruiksgegevens: berichten, verzendtijden, geopende profielen, gebruikte functies, aangekochte en gebruikte credits, klikgedrag binnen het platform.",
        "Technische gegevens: IP-adres, apparaat, browser, besturingssysteem, sessiegegevens, logbestanden, cookie-ID’s en beveiligingsinformatie.",
        "Betaalgegevens: transactie-ID, bedrag, datum, betaalmethode, status van betaling, factuurgegevens en gegevens die wij ontvangen van onze betaalprovider. Wij slaan geen volledige creditcardgegevens op als de betaling via een externe betaalprovider loopt.",
        "Supportgegevens: e-mails, klachten, refundverzoeken, bewijsstukken en communicatie met onze klantenservice.",
        "Marketing- en cookiegegevens: cookievoorkeuren, advertentie-ID’s, analyticsgegevens, campagnebron, conversies en toestemming voor marketingcookies.",
      ],
    },
    {
      id: "art-3",
      title: "3 — Bijzondere persoonsgegevens",
      paragraphs: [
        "Omdat het platform gericht is op volwassen chat en entertainment, kunnen gebruikers informatie delen waaruit seksuele interesses, voorkeuren of gedrag kunnen blijken. Gegevens over iemands seksleven of seksuele gerichtheid worden in de EU als gevoelige persoonsgegevens gezien en hebben extra bescherming nodig.",
        "Wij vragen gebruikers daarom geen gevoelige informatie te delen die niet nodig is voor het gebruik van het platform.",
        "Als je zelf gevoelige informatie in je profiel, foto’s of berichten plaatst, geef je ons toestemming om die informatie te verwerken voor het aanbieden, tonen, beveiligen en modereren van het platform. Je kunt die toestemming intrekken door je content te verwijderen of je account te laten verwijderen. Het kan dan zijn dat je het platform niet meer volledig kunt gebruiken.",
      ],
    },
    {
      id: "art-4",
      title: "4 — Waarom verwerken wij gegevens?",
      paragraphs: ["Wij verwerken persoonsgegevens voor deze doelen:"],
      bullets: [
        "account aanmaken en beheren;",
        "toegang geven tot het platform;",
        "credits verkopen en verwerken;",
        "berichten en profielinteracties mogelijk maken;",
        "klantenservice en klachtenafhandeling;",
        "fraude, misbruik en illegale content voorkomen;",
        "leeftijdscontrole en veiligheid;",
        "betalingen, administratie en wettelijke verplichtingen;",
        "verbetering van het platform;",
        "analytics en conversiemeting;",
        "marketing, alleen waar toestemming of een andere grondslag geldt;",
        "juridische claims, chargebacks en bewijsvoering.",
      ],
    },
    {
      id: "art-5",
      title: "5 — Op welke grondslagen verwerken wij gegevens?",
      paragraphs: ["Wij verwerken gegevens op basis van:"],
      bullets: [
        "Uitvoering van de overeenkomst: voor accountbeheer, chats, credits, betalingen en support.",
        "Toestemming: voor marketingcookies, bepaalde advertentietechnologie, nieuwsbrieven en waar nodig voor gevoelige gegevens die je zelf deelt.",
        "Gerechtvaardigd belang: voor beveiliging, fraudepreventie, moderatie, productverbetering, misbruikdetectie en juridische bescherming.",
        "Wettelijke verplichting: voor fiscale administratie, boekhouding, betaalgegevens en wettelijke verzoeken van autoriteiten.",
      ],
    },
    {
      id: "art-6",
      title: "6 — AI, operators en moderatie",
      paragraphs: [
        "Wij kunnen gebruikmaken van menselijke operators, externe dienstverleners en AI-systemen om chats, entertainmentprofielen, support, moderatie, veiligheid en productverbetering te ondersteunen.",
        "Wanneer AI direct wordt gebruikt in communicatie met gebruikers, zorgen wij voor een duidelijke melding dat AI betrokken kan zijn.",
        "Wij kunnen berichten automatisch of handmatig controleren op misbruik, fraude, spam, illegale content en overtreding van onze voorwaarden.",
      ],
    },
    {
      id: "art-7",
      title: "7 — Delen wij gegevens met anderen?",
      paragraphs: [
        "Wij kunnen gegevens delen met:",
        "Met partijen die namens ons persoonsgegevens verwerken sluiten wij waar nodig verwerkersovereenkomsten.",
        "Wij verkopen geen persoonlijke chatgegevens aan derden.",
      ],
      bullets: [
        "hostingproviders;",
        "betaalproviders;",
        "analytics- en advertentiediensten;",
        "klantenservice- en moderatietools;",
        "e-mailproviders;",
        "IT-beveiligingsdiensten;",
        "boekhouder, accountant of juridisch adviseur;",
        "bevoegde autoriteiten als dit wettelijk verplicht is;",
        "externe chatoperators of dienstverleners die namens ons werken.",
      ],
    },
    {
      id: "art-8",
      title: "8 — Cookies",
      paragraphs: [
        "Wij gebruiken functionele cookies om het platform te laten werken. Wij kunnen analytische cookies gebruiken om het platform te verbeteren.",
        "Voor trackingcookies, advertentiecookies of cookies die gebruikers over websites heen volgen, vragen wij vooraf toestemming. Bezoekers moeten actief kunnen kiezen en toestemming moet net zo makkelijk kunnen worden ingetrokken als gegeven.",
        `Je kunt je cookievoorkeuren aanpassen via ons cookiebeleid (${LEGAL_PATHS.cookies}).`,
      ],
    },
    {
      id: "art-9",
      title: "9 — Hoe lang bewaren wij gegevens?",
      paragraphs: [
        "Wij bewaren gegevens niet langer dan nodig.",
        "Richtlijnen:",
      ],
      bullets: [
        "accountgegevens: zolang je account actief is;",
        "profielgegevens: zolang je profiel actief is of totdat je deze verwijdert;",
        "chatgegevens: zolang nodig voor de dienst, veiligheid, klachten en juridische bescherming;",
        "betaal- en factuurgegevens: zolang wettelijk verplicht;",
        "supportgegevens: zolang nodig voor afhandeling en bewijsvoering;",
        "technische logs: zo kort mogelijk, tenzij nodig voor beveiliging of fraudeonderzoek;",
        "geblokkeerde accounts: langer indien nodig om misbruik, fraude of herregistratie te voorkomen.",
      ],
    },
    {
      id: "art-10",
      title: "10 — Beveiliging",
      paragraphs: [
        "Wij nemen passende technische en organisatorische maatregelen om persoonsgegevens te beschermen, waaronder waar passend:",
        `Geen enkel systeem is 100% veilig. Meld beveiligingsproblemen via ${LEGAL_SECURITY_EMAIL}.`,
      ],
      bullets: [
        "versleutelde verbindingen;",
        "wachtwoordhashing;",
        "toegangsbeperking voor medewerkers en operators;",
        "logging en monitoring;",
        "back-ups;",
        "beveiliging van betaalprocessen via betaalproviders;",
        "procedures voor datalekken.",
      ],
    },
    {
      id: "art-11",
      title: "11 — Jouw rechten",
      paragraphs: [
        "Je hebt onder de AVG rechten, waaronder:",
        `Verzoeken kunnen worden gestuurd naar ${LEGAL_PRIVACY_EMAIL}.`,
        "Wij kunnen vragen om aanvullende informatie om je identiteit te controleren.",
      ],
      bullets: [
        "inzage in je persoonsgegevens;",
        "correctie van onjuiste gegevens;",
        "verwijdering van gegevens;",
        "beperking van verwerking;",
        "bezwaar tegen verwerking;",
        "overdraagbaarheid van gegevens;",
        "intrekken van toestemming;",
        "klacht indienen bij de Autoriteit Persoonsgegevens.",
      ],
    },
    {
      id: "art-12",
      title: "12 — Gegevens buiten de EU",
      paragraphs: [
        "Sommige dienstverleners kunnen gegevens verwerken buiten de Europese Economische Ruimte. In dat geval nemen wij passende maatregelen, zoals standaardcontractbepalingen of andere geldige waarborgen.",
      ],
    },
    {
      id: "art-13",
      title: "13 — Datalekken",
      paragraphs: [
        "Als er sprake is van een datalek, beoordelen wij de impact. Waar wettelijk verplicht melden wij dit aan de Autoriteit Persoonsgegevens en/of betrokken gebruikers.",
      ],
    },
    {
      id: "art-14",
      title: "14 — Wijzigingen",
      paragraphs: [
        "Wij kunnen deze privacyverklaring wijzigen. De nieuwste versie staat altijd op onze website. Bij belangrijke wijzigingen informeren wij gebruikers via de website, per e-mail of in het account.",
      ],
    },
  ],
};
