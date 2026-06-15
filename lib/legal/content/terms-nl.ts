import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTROLLER_ADDRESS,
  LEGAL_CONTROLLER_NAME,
  LEGAL_COUNTRY,
  LEGAL_KVK,
  LEGAL_LAST_UPDATED,
  LEGAL_SITE_LABEL,
} from "@/lib/legal/constants";
import type { LegalDocument } from "@/lib/legal/types";

export const termsNl: LegalDocument = {
  title: "Algemene voorwaarden",
  subtitle: LEGAL_SITE_LABEL,
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      id: "intro",
      title: "1. Wie zijn wij",
      paragraphs: [
        `Deze algemene voorwaarden (“Voorwaarden”) gelden voor het gebruik van de website en app van ${LEGAL_SITE_LABEL} (de “Dienst”).`,
        `De Dienst wordt aangeboden door ${LEGAL_CONTROLLER_NAME}, gevestigd te ${LEGAL_CONTROLLER_ADDRESS}, ingeschreven bij de Kamer van Koophandel onder nummer ${LEGAL_KVK} (“wij”, “ons”).`,
        `Contact: ${LEGAL_CONTACT_EMAIL}.`,
        `Door een account aan te maken, een Berichtenbundel te kopen of de Dienst anderszins te gebruiken, ga je een overeenkomst met ons aan en accepteer je deze Voorwaarden en ons privacybeleid.`,
      ],
    },
    {
      id: "service",
      title: "2. Wat is de Dienst",
      paragraphs: [
        `${LEGAL_SITE_LABEL} is een online chatplatform waar je gesprekken kunt voeren met profielen en persona’s. De Dienst is bedoeld als entertainment en sociale interactie, niet als matchmaking-garantie, therapie, juridisch of medisch advies.`,
        "Gesprekken kunnen (deels) automatisch worden gegenereerd met kunstmatige intelligentie (AI) en/of worden beantwoord door menselijke chatoperators. Profielfoto’s, namen en achtergronden kunnen fictief of samengesteld zijn en hoeven niet overeen te komen met de persoon die daadwerkelijk typt.",
        "Het is de bedoeling dat de ervaring spannend en verleidelijk aanvoelt; het is niet gegarandeerd of duidelijk of een profiel een ‘echt’ iemand in de zin van de foto is, een persona, een AI of een combinatie daarvan. Wij garanderen geen ontmoetingen in het echte leven, relatie-resultaten of reactietijden.",
      ],
    },
    {
      id: "age",
      title: "3. Leeftijd en account",
      paragraphs: [
        "Je moet minimaal 18 jaar zijn om de Dienst te gebruiken. Je bent verantwoordelijk voor juiste registratiegegevens en voor het geheim houden van je inloggegevens.",
        "Je mag slechts één persoonlijk account aanmaken. Wij mogen accounts blokkeren of verwijderen bij misbruik, fraude of schending van deze Voorwaarden.",
      ],
    },
    {
      id: "credits",
      title: "4. Berichtenbundels en betalingen",
      paragraphs: [
        "Voor bepaalde acties (zoals het versturen van berichten of het ontgrendelen van content) heb je tegoed in een Berichtenbundel nodig. Dit tegoed is een digitaal saldo binnen de Dienst, geen geld op een bankrekening, en is niet overdraagbaar of inwisselbaar voor contanten.",
        "Prijzen worden getoond in euro’s vóór afrekenen. Betalingen verlopen via onze betalingsprovider (Stripe). Wij slaan geen volledige kaartgegevens op.",
        "Tegoed wordt toegevoegd na geslaagde betaling. Het verbruik per actie (bijv. een chatbericht) staat in de app vermeld en kan wijzigen; wijzigingen gelden voor toekomstig verbruik.",
      ],
      bullets: [
        "Tegoed vervalt bij beëindiging van je account wegens ernstig misbruik, zoals bepaald door ons.",
        "Wij bieden geen doorlopend abonnement (Pro) aan via deze Voorwaarden; alleen losse Berichtenbundels.",
      ],
    },
    {
      id: "refunds",
      title: "5. Herroeping en restitutie (Berichtenbundels)",
      paragraphs: [
        "Omdat Berichtenbundels digitaal zijn en direct beschikbaar komen na betaling, vervalt je herroepingsrecht zodra de levering is begonnen, mits je daarvoor uitdrukkelijk toestemming hebt gegeven bij de aankoop en hebt bevestigd dat je je herroepingsrecht verliest zodra het tegoed op je account staat.",
        "Restitutie van een Berichtenbundel is in de volgende gevallen mogelijk:",
        "Geen restitutie: verbruikt tegoed, tegoed verkregen via promoties, of aankopen ouder dan 14 dagen (tenzij wettelijk anders verplicht). Chargebacks zonder eerst contact op te nemen kunnen leiden tot blokkade van je account.",
      ],
      bullets: [
        "Dubbele afschrijving of technische fout waardoor tegoed niet is bijgeschreven terwijl wel is betaald — na controle schrijven wij tegoed bij of betalen we terug via de oorspronkelijke betaalmethode.",
        `Binnen 14 dagen na aankoop, alleen als je nog geen tegoed uit de betreffende bundel hebt verbruikt; aanvraag via ${LEGAL_CONTACT_EMAIL} met je account-e-mail en betaalbewijs.`,
        "Wanneer wij de Dienst permanent beëindigen binnen 30 dagen na je aankoop, naar rato van ongebruikt tegoed uit die bundel.",
      ],
    },
    {
      id: "conduct",
      title: "6. Gedrag en content",
      paragraphs: [
        "Je bent zelf verantwoordelijk voor wat je verstuurt. Het is verboden om:",
        "Wij mogen berichten verwijderen, accounts beperken en meldingen doen bij autoriteiten indien nodig.",
      ],
      bullets: [
        "Minderjarigen te betrekken of content met minderjarigen te delen;",
        "Illegale, gewelddadige, bedreigende, haatdragende of niet-consensuele content te delen;",
        "Persoonsgegevens van anderen zonder toestemming te verspreiden;",
        "Spam, oplichting of misbruik van het bundelsysteem;",
        "De Dienst te reverse-engineeren of te scrapen.",
      ],
    },
    {
      id: "ip",
      title: "7. Intellectueel eigendom",
      paragraphs: [
        "De Dienst, het ontwerp, logo’s en door ons gecreëerde persona-materiaal blijven ons eigendom of dat van onze licentiegevers. Je behoudt eigendom van je eigen user-generated content, maar verleent ons een licentie om deze te hosten, te tonen en te verwerken (inclusief voor AI en operators) voor het leveren van de Dienst.",
      ],
    },
    {
      id: "availability",
      title: "8. Beschikbaarheid en wijzigingen",
      paragraphs: [
        "De Dienst wordt geleverd “as is”. Onderhoud, storingen of wijzigingen zijn mogelijk. Wij mogen functionaliteit of prijzen aanpassen; voor wezenlijke wijzigingen die nadelig zijn voor consumenten, informeren wij waar redelijk mogelijk.",
      ],
    },
    {
      id: "liability",
      title: "9. Aansprakelijkheid",
      paragraphs: [
        "Voor zover wettelijk toegestaan zijn wij niet aansprakelijk voor indirecte schade, gemiste winst of schade door handelingen van andere gebruikers, AI-output of operators. Onze totale aansprakelijkheid per gebeurtenis is beperkt tot het bedrag dat je in de 12 maanden vóór de claim aan Berichtenbundels hebt betaald, met een maximum van €150, tenzij dwingend recht anders voorschrijft.",
        "Niets in deze Voorwaarden beperkt aansprakelijkheid voor dood of letsel door opzet of bewuste roekeloosheid, of fraude.",
      ],
    },
    {
      id: "termination",
      title: "10. Beëindiging",
      paragraphs: [
        "Je kunt je account beëindigen via de app of door contact op te nemen. Wij kunnen je account opschorten of beëindigen bij overtreding van deze Voorwaarden. Ongebruikt tegoed in je Berichtenbundel wordt bij beëindiging wegens overtreding niet gerestitueerd, tenzij wettelijk anders vereist.",
      ],
    },
    {
      id: "law",
      title: "11. Toepasselijk recht en geschillen",
      paragraphs: [
        `Op deze Voorwaarden is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in ${LEGAL_COUNTRY}, behoudens dwingende consumentenbescherming in je woonland binnen de EU.`,
        "Consumenten kunnen ook gebruikmaken van het EU-platform voor onlinegeschillenbeslechting: https://ec.europa.eu/consumers/odr/",
      ],
    },
  ],
};
