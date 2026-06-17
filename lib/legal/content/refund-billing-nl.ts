import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  LEGAL_SITE_LABEL,
} from "@/lib/legal/constants";
import type { LegalDocument } from "@/lib/legal/types";

export const refundBillingNl: LegalDocument = {
  title: "Refund & Billing Policy",
  subtitle: LEGAL_SITE_LABEL,
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      id: "art-1",
      title: "1. Wat koop je?",
      paragraphs: [
        `Deze Refund & Billing Policy geldt voor aankopen op ${LEGAL_SITE_LABEL}.`,
        `Op ${LEGAL_SITE_LABEL} koop je digitale credits. Deze credits kunnen worden gebruikt om berichten te versturen en bepaalde functies binnen het platform te gebruiken.`,
        "Credits zijn digitale tegoeden. Credits hebben geen contante waarde en kunnen niet worden ingewisseld voor geld, behalve wanneer dit wettelijk verplicht is.",
      ],
    },
    {
      id: "art-2",
      title: "2. Wanneer worden credits geleverd?",
      paragraphs: [
        "Na succesvolle betaling worden credits normaal gesproken direct toegevoegd aan je account.",
        `Als credits door een technische storing niet verschijnen, kun je contact opnemen via ${LEGAL_CONTACT_EMAIL}. Wij controleren dan de betaling en voegen de credits alsnog toe of bieden een passende oplossing.`,
      ],
    },
    {
      id: "art-3",
      title: "3. Prijzen en betalingen",
      paragraphs: [
        "Alle prijzen worden vóór betaling duidelijk getoond. Eventuele btw, transactiekosten of andere kosten worden weergegeven voordat je de betaling bevestigt.",
        "Betalingen worden verwerkt via onze betaalprovider. Wij slaan zelf geen volledige creditcardgegevens op.",
      ],
    },
    {
      id: "art-4",
      title: "4. Directe start van de dienst",
      paragraphs: [
        "Door credits te kopen, geef je toestemming dat de digitale dienst direct na betaling start. Dit betekent dat je credits meteen kunt gebruiken.",
        "Gebruikte credits worden niet terugbetaald, omdat de dienst op jouw verzoek direct is geleverd.",
      ],
    },
    {
      id: "art-5",
      title: "5. Herroepingsrecht en terugbetaling",
      paragraphs: [
        "Je kunt binnen 14 dagen na aankoop een refund aanvragen voor credits die nog niet zijn gebruikt.",
        "Voor gebruikte credits geldt geen terugbetaling, tenzij wij wettelijk verplicht zijn om terug te betalen of tenzij er sprake is van een aantoonbare technische fout aan onze kant.",
        "Voorbeeld:",
      ],
      bullets: [
        "Je koopt 100 credits en gebruikt 0 credits: refund mogelijk binnen 14 dagen.",
        "Je koopt 100 credits en gebruikt 40 credits: alleen de resterende ongebruikte credits kunnen eventueel worden terugbetaald.",
        "Je koopt 100 credits en gebruikt alle credits: geen refund.",
      ],
    },
    {
      id: "art-6",
      title: "6. Geen refund in deze gevallen",
      paragraphs: ["Wij geven geen refund bij:"],
      bullets: [
        "gebruikte credits;",
        "ontevredenheid over gesprekken of reacties;",
        "geen fysieke afspraak;",
        "geen contact buiten het platform;",
        "blokkering wegens misbruik, fraude of overtreding van onze voorwaarden;",
        "poging tot chargebackfraude;",
        "het delen van je account met anderen;",
        "aankopen die zijn gedaan door iemand die toegang had tot jouw account.",
      ],
    },
    {
      id: "art-7",
      title: "7. Entertainmentkarakter van het platform",
      paragraphs: [
        `${LEGAL_SITE_LABEL} is een volwassen chatplatform voor entertainment en online contact. Sommige profielen kunnen entertainmentprofielen zijn en kunnen worden beheerd of ondersteund door operators en/of AI.`,
        "Credits geven toegang tot chatfuncties binnen het platform. Credits geven geen recht op een fysieke afspraak, relatie, seksueel contact, WhatsApp-contact, Telegram-contact of contact buiten het platform.",
      ],
    },
    {
      id: "art-8",
      title: "8. Chargebacks",
      paragraphs: [
        "Als je zonder geldige reden een chargeback start nadat credits zijn geleverd of gebruikt, mogen wij je account tijdelijk blokkeren terwijl wij de betaling onderzoeken.",
        "Bij misbruik, fraude of herhaalde chargebacks mogen wij je account permanent blokkeren.",
      ],
    },
    {
      id: "art-9",
      title: "9. Refund aanvragen",
      paragraphs: [
        "Refundverzoeken kunnen worden gestuurd naar:",
        `E-mail: ${LEGAL_CONTACT_EMAIL}`,
        "Vermeld hierbij:",
        "Wij proberen refundverzoeken binnen 14 dagen te beantwoorden.",
      ],
      bullets: [
        "je accountnaam of e-mailadres;",
        "datum van aankoop;",
        "bedrag;",
        "betaalmethode;",
        "reden van je verzoek.",
      ],
    },
    {
      id: "art-10",
      title: "10. Wijzigingen",
      paragraphs: [
        "Wij kunnen deze Refund & Billing Policy wijzigen. De nieuwste versie staat altijd op onze website.",
      ],
    },
  ],
};
