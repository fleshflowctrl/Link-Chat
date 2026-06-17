import {
  LEGAL_BTW,
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTROLLER_ADDRESS,
  LEGAL_CONTROLLER_NAME,
  LEGAL_COUNTRY,
  LEGAL_KVK,
  LEGAL_LAST_UPDATED,
  LEGAL_SITE_DOMAIN,
  LEGAL_SITE_LABEL,
} from "@/lib/legal/constants";
import type { LegalDocument } from "@/lib/legal/types";

const LEGAL_WEBSITE = `www.${LEGAL_SITE_DOMAIN}`;

export const termsNl: LegalDocument = {
  title: "Algemene voorwaarden",
  subtitle: LEGAL_SITE_LABEL,
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      id: "art-1",
      title: "Artikel 1 — Wie zijn wij?",
      paragraphs: [
        `${LEGAL_SITE_LABEL} wordt aangeboden door:`,
        "Deze algemene voorwaarden gelden voor ieder gebruik van onze website, accounts, profielen, chats, credits en betaalde diensten.",
      ],
      bullets: [
        `Bedrijfsnaam: ${LEGAL_CONTROLLER_NAME}`,
        `Handelsnaam: ${LEGAL_SITE_LABEL}`,
        `KVK-nummer: ${LEGAL_KVK}`,
        `BTW-nummer: ${LEGAL_BTW}`,
        `Vestigingsadres: ${LEGAL_CONTROLLER_ADDRESS}`,
        `E-mail: ${LEGAL_CONTACT_EMAIL}`,
        `Website: ${LEGAL_WEBSITE}`,
      ],
    },
    {
      id: "art-2",
      title: "Artikel 2 — Definities",
      paragraphs: ["In deze voorwaarden bedoelen wij met:"],
      bullets: [
        `Platform: de website, mobiele website, applicatie of online omgeving van ${LEGAL_SITE_LABEL}.`,
        "Gebruiker: iedere persoon die het platform bezoekt of een account aanmaakt.",
        "Credits: digitale tegoeden waarmee gebruikers bepaalde functies kunnen gebruiken, zoals het versturen van berichten.",
        "Entertainmentprofiel: een profiel dat door ons, door derden in onze opdracht, door operators of met behulp van AI kan zijn aangemaakt, beheerd of ondersteund.",
        "Dienst: het aanbieden van een discreet volwassen chatplatform voor entertainment en online contact.",
      ],
    },
    {
      id: "art-3",
      title: "Artikel 3 — Leeftijd: 18+",
      paragraphs: [
        "Het platform is uitsluitend bedoeld voor personen van 18 jaar en ouder.",
        "Door een account aan te maken of credits te kopen, verklaar je dat je minimaal 18 jaar oud bent. Wij mogen accounts blokkeren of verwijderen als wij vermoeden dat een gebruiker jonger is dan 18 jaar of onjuiste informatie heeft gegeven.",
        "Het is verboden om content te plaatsen, te verzenden of te vragen die betrekking heeft op minderjarigen. Bij vermoedens van illegale content kunnen wij accounts blokkeren, gegevens veiligstellen en waar nodig melding doen bij bevoegde instanties.",
      ],
    },
    {
      id: "art-4",
      title: "Artikel 4 — Aard van het platform",
      paragraphs: [
        `${LEGAL_SITE_LABEL} is een discreet volwassen chatplatform voor entertainment en online contact.`,
        "Het platform is niet bedoeld als garantie op een fysieke afspraak, relatie, seksueel contact, WhatsApp-contact, Telegram-contact of contact buiten het platform.",
        "Wij beloven niet dat gebruikers elkaar daadwerkelijk ontmoeten. Wij beloven ook niet dat een bepaald profiel in jouw buurt woont, direct beschikbaar is of persoonlijk op jou wacht, tenzij dat expliciet en aantoonbaar klopt.",
      ],
    },
    {
      id: "art-5",
      title: "Artikel 5 — Entertainmentprofielen, operators en AI",
      paragraphs: [
        "Het platform kan gebruikmaken van entertainmentprofielen. Dit betekent dat sommige profielen en gesprekken kunnen worden aangemaakt, beheerd of ondersteund door:",
        "Entertainmentprofielen zijn bedoeld voor entertainment, fantasie, gesprek en online interactie binnen het platform. Een entertainmentprofiel is niet altijd een zelfstandig privépersoon die fysiek wil afspreken.",
        "Berichten van entertainmentprofielen kunnen zijn geschreven of ondersteund door operators of AI. Wanneer AI direct met gebruikers communiceert, moet dat duidelijk worden gemaakt; de EU AI Act legt transparantieverplichtingen op voor AI-systemen zoals chatbots waarbij mensen moeten weten dat ze met een machine communiceren.",
        "Wij raden aan om entertainmentprofielen in de interface herkenbaar te maken met een label zoals “Entertainmentprofiel”, “Chatprofiel” of “Digitaal profiel”.",
      ],
      bullets: [
        "medewerkers van ons bedrijf;",
        "externe chatoperators;",
        "door ons ingeschakelde dienstverleners;",
        "AI-systemen of geautomatiseerde ondersteuning;",
        "een combinatie hiervan.",
      ],
    },
    {
      id: "art-6",
      title: "Artikel 6 — Geen garanties",
      paragraphs: [
        "Wij geven geen garantie dat:",
        "Als een profiel niet daadwerkelijk is geverifieerd, gebruiken wij geen woorden zoals “geverifieerd”, “echt gecontroleerd” of vergelijkbare claims.",
      ],
      bullets: [
        "een gebruiker of profiel zal reageren;",
        "een gesprek tot een afspraak leidt;",
        "informatie in profielen volledig of actueel is;",
        "een profiel buiten het platform bereikbaar is;",
        "gebruikers echt interesse hebben in een fysieke ontmoeting;",
        "gebruikers hun identiteit buiten eventuele expliciete verificatie volledig juist hebben opgegeven.",
      ],
    },
    {
      id: "art-7",
      title: "Artikel 7 — Account aanmaken",
      paragraphs: [
        "Je moet correcte en actuele informatie geven bij het aanmaken van een account. Je bent zelf verantwoordelijk voor je inloggegevens en voor alle activiteiten op jouw account.",
        "Je mag geen account aanmaken namens iemand anders zonder toestemming. Je mag ook geen foto’s of persoonsgegevens van anderen gebruiken zonder toestemming.",
        "Wij mogen een account weigeren, tijdelijk blokkeren of verwijderen bij misbruik, fraude, overtreding van deze voorwaarden, chargebacks, bedreiging, spam, illegale content of gedrag dat schadelijk is voor het platform of andere gebruikers.",
      ],
    },
    {
      id: "art-8",
      title: "Artikel 8 — Gedragsregels",
      paragraphs: [
        "Je mag het platform niet gebruiken voor:",
        "Wij mogen berichten, profielen of content verwijderen als deze regels worden overtreden.",
      ],
      bullets: [
        "illegale activiteiten;",
        "bedreiging, intimidatie, stalking of chantage;",
        "oplichting, phishing of financiële manipulatie;",
        "prostitutie, escortafspraken of seksuele diensten tegen betaling;",
        "het delen of vragen van content met minderjarigen;",
        "het uploaden van foto’s zonder toestemming van de afgebeelde persoon;",
        "het verspreiden van malware, spam of misleidende links;",
        "het omzeilen van betaalde functies;",
        "het verzamelen van gegevens van andere gebruikers;",
        "het plaatsen van externe contactgegevens als wij dat op het platform verbieden.",
      ],
    },
    {
      id: "art-9",
      title: "Artikel 9 — Credits en betalingen",
      paragraphs: [
        "Voor bepaalde functies, zoals het versturen van berichten, kunnen credits nodig zijn.",
        "De prijs, inhoud en voorwaarden van creditpakketten worden vóór aankoop getoond. De stap vóór betaling moet duidelijk maken wat de gebruiker koopt, wat het kost en welke voorwaarden gelden; ACM noemt dit onderdeel van de informatieplicht bij online verkoop.",
        "Credits hebben geen contante waarde en kunnen niet worden ingewisseld voor geld, behalve wanneer dit wettelijk verplicht is of wanneer wij schriftelijk anders beslissen.",
        "Credits zijn gekoppeld aan jouw account en mogen niet worden verkocht, overgedragen of gedeeld met andere accounts.",
      ],
    },
    {
      id: "art-10",
      title: "Artikel 10 — Herroepingsrecht en refunds",
      paragraphs: [
        "Bij online aankopen geldt vaak een wettelijke bedenktijd van 14 dagen. Voor digitale diensten die direct starten, is vooral belangrijk dat de gebruiker vooraf toestemming geeft voor directe uitvoering en begrijpt wat dit betekent voor gebruikte diensten of credits. ACM legt uit dat bij een dienst die tijdens de bedenktijd start, de consument onder voorwaarden voor het gebruikte deel moet betalen of bij volledige levering het herroepingsrecht kan verliezen.",
        "Ons refundbeleid:",
        "Op de betaalpagina vragen wij je uitdrukkelijk akkoord te gaan met de volgende tekst:",
        "“Ik ga ermee akkoord dat de dienst direct na betaling start. Ik begrijp dat gebruikte credits niet worden terugbetaald.”",
      ],
      bullets: [
        "Ongebruikte credits kunnen binnen 14 dagen na aankoop worden terugbetaald als je gebruikmaakt van je wettelijke herroepingsrecht, tenzij wettelijk anders toegestaan.",
        "Credits die al zijn gebruikt voor berichten of functies worden niet terugbetaald, voor zover je vooraf akkoord bent gegaan met directe uitvoering van de dienst en betaling voor het gebruikte deel.",
        "Wij betalen niet terug bij blokkering wegens fraude, misbruik, overtreding van deze voorwaarden of chargebackfraude.",
        "Bij technische fouten beoordelen wij per geval of herstel, nieuwe credits of terugbetaling passend is.",
        `Refundverzoeken kunnen worden gestuurd naar ${LEGAL_CONTACT_EMAIL}.`,
      ],
    },
    {
      id: "art-11",
      title: "Artikel 11 — Externe contactgegevens",
      paragraphs: [
        "Wij mogen het delen van WhatsApp, Telegram, telefoonnummers, e-mailadressen, social media handles of betaalverzoeken blokkeren of beperken.",
        "De dienst vindt plaats binnen het platform. Wij zijn niet verantwoordelijk voor schade, misleiding, oplichting, bedreiging of afspraken die buiten het platform ontstaan.",
      ],
    },
    {
      id: "art-12",
      title: "Artikel 12 — Content van gebruikers",
      paragraphs: [
        "Je blijft eigenaar van content die je zelf plaatst, zoals tekst, profielinformatie en foto’s. Door content te plaatsen geef je ons toestemming om die content te gebruiken voor het aanbieden, tonen, beveiligen, modereren en verbeteren van het platform.",
        "Je mag alleen content plaatsen waarvoor je de rechten en toestemming hebt.",
        "Wij mogen content verwijderen als deze in strijd is met de wet, deze voorwaarden, rechten van derden of onze veiligheidsregels.",
        "Als gebruikers zelf content kunnen plaatsen die voor anderen zichtbaar is, kan de Digital Services Act relevant zijn. Online diensten waar gebruikers content kunnen opslaan of plaatsen, zoals platforms met profielen, afbeeldingen of berichten, kunnen onder DSA-regels vallen.",
      ],
    },
    {
      id: "art-13",
      title: "Artikel 13 — Moderatie en veiligheid",
      paragraphs: [
        "Wij mogen profielen, foto’s, berichten en transacties automatisch of handmatig controleren op fraude, misbruik, illegale content, spam, bedreiging en overtreding van deze voorwaarden.",
        "Wij mogen maatregelen nemen zoals:",
      ],
      bullets: [
        "waarschuwing;",
        "content verwijderen;",
        "functies beperken;",
        "credits tijdelijk bevriezen;",
        "account blokkeren;",
        "account verwijderen;",
        "melding doen aan bevoegde instanties als dit noodzakelijk of wettelijk verplicht is.",
      ],
    },
    {
      id: "art-14",
      title: "Artikel 14 — Beschikbaarheid van de dienst",
      paragraphs: [
        "Wij proberen het platform goed beschikbaar te houden, maar garanderen niet dat de dienst altijd foutloos, veilig of onafgebroken werkt.",
        "Wij mogen het platform tijdelijk onderbreken voor onderhoud, updates, beveiliging of technische problemen.",
      ],
    },
    {
      id: "art-15",
      title: "Artikel 15 — Aansprakelijkheid",
      paragraphs: [
        "Wij zijn niet aansprakelijk voor:",
        "Niets in deze voorwaarden beperkt aansprakelijkheid voor opzet, grove nalatigheid of aansprakelijkheid die volgens de wet niet mag worden uitgesloten.",
      ],
      bullets: [
        "keuzes die gebruikers maken op basis van gesprekken;",
        "schade door contact buiten het platform;",
        "onjuiste informatie die gebruikers zelf plaatsen;",
        "verlies van toegang door eigen fout, zoals het delen van wachtwoorden;",
        "indirecte schade, omzetverlies of gevolgschade, voor zover wettelijk toegestaan.",
      ],
    },
    {
      id: "art-16",
      title: "Artikel 16 — Klachten",
      paragraphs: [
        "Klachten kunnen worden gestuurd naar:",
        `E-mail: ${LEGAL_CONTACT_EMAIL}`,
        "Wij proberen klachten binnen 14 dagen inhoudelijk te beantwoorden.",
      ],
    },
    {
      id: "art-17",
      title: "Artikel 17 — Wijzigingen",
      paragraphs: [
        "Wij mogen deze voorwaarden wijzigen. Bij belangrijke wijzigingen informeren wij gebruikers via de website, per e-mail of in het account.",
        "Als je het platform blijft gebruiken na wijziging, ga je akkoord met de nieuwe voorwaarden.",
      ],
    },
    {
      id: "art-18",
      title: "Artikel 18 — Toepasselijk recht",
      paragraphs: [
        "Op deze voorwaarden is Nederlands recht van toepassing, tenzij dwingend consumentenrecht anders bepaalt.",
        `Geschillen worden voorgelegd aan de bevoegde rechter in ${LEGAL_COUNTRY}, tenzij de wet een andere rechter verplicht aanwijst.`,
      ],
    },
  ],
};
