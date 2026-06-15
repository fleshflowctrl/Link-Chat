import {
  LEGAL_BTW,
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTROLLER_ADDRESS,
  LEGAL_CONTROLLER_NAME,
  LEGAL_DATA_REGION,
  LEGAL_KVK,
  LEGAL_LAST_UPDATED,
  LEGAL_SITE_LABEL,
} from "@/lib/legal/constants";
import type { LegalDocument } from "@/lib/legal/types";

export const privacyNl: LegalDocument = {
  title: "Privacybeleid",
  subtitle: LEGAL_SITE_LABEL,
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      id: "controller",
      title: "1. Verwerkingsverantwoordelijke",
      paragraphs: [
        `${LEGAL_CONTROLLER_NAME}, ${LEGAL_CONTROLLER_ADDRESS}, KvK ${LEGAL_KVK}, BTW ${LEGAL_BTW}.`,
        `E-mail: ${LEGAL_CONTACT_EMAIL}.`,
        "Dit privacybeleid legt uit welke persoonsgegevens wij verwerken via de Dienst, waarom, op welke grondslag, hoe lang, en welke rechten je hebt (AVG/GDPR).",
      ],
    },
    {
      id: "data",
      title: "2. Welke gegevens verwerken wij",
      paragraphs: ["Wij kunnen de volgende categorieën verwerken:"],
      bullets: [
        "Account: e-mailadres, wachtwoord (versleuteld via onze auth-provider), gebruikers-id;",
        "Profiel: naam, leeftijd, locatie, foto’s, bio, voorkeuren uit onboarding;",
        "Chat: berichten (tekst), afbeeldingen die je uploadt, leesstatus, reacties, gifts;",
        "Betalingen: factuur- en transactiegegevens via Stripe (wij zien geen volledige kaartnummers);",
        "Technisch: IP-adres, apparaat/browser, cookies, sessie-id’s, foutlogs;",
        "Analytics: een pseudonieme bezoeker-id in je browser (localStorage) voor statistieken;",
        "Communicatie: e-mails die wij je sturen (transactie en marketing, zie §8).",
      ],
    },
    {
      id: "personas",
      title: "3. Profielen, AI en operators",
      paragraphs: [
        "Gesprekspartners in de app zijn persona’s. Berichten kunnen worden opgesteld door geautomatiseerde systemen (AI, o.a. xAI/Grok) en/of door menselijke chatoperators. De persoon op een profielfoto is niet per se dezelfde als degene die antwoordt.",
        "Inhoud van chats wordt verwerkt om antwoorden te genereren, kwaliteit te bewaken, misbruik te voorkomen en (intern) samenvattingen te maken voor operators. Gebruik de Dienst niet voor zeer gevoelige gezondheids-, financiële of juridische informatie die je niet wilt delen.",
      ],
    },
    {
      id: "purposes",
      title: "4. Doelen en grondslagen",
      paragraphs: ["Wij verwerken gegevens voor:"],
      bullets: [
        "Het leveren van de Dienst (uitvoering overeenkomst);",
        "Berichtenbundels en betalingen (overeenkomst, wettelijke administratie);",
        "Beveiliging, fraudepreventie en misbruikbestrijding (gerechtvaardigd belang);",
        "Ongelezen-bericht e-mails en serviceberichten (overeenkomst / gerechtvaardigd belang);",
        "Marketing per e-mail (toestemming — je kunt je altijd afmelden);",
        "Analytics ter verbetering van de app (toestemming waar vereist, anders geaggregeerd/gerechtvaardigd belang).",
      ],
    },
    {
      id: "processors",
      title: "5. Verwerkers en doorgifte",
      paragraphs: [
        `Wij hosten en verwerken gegevens primair in de ${LEGAL_DATA_REGION}. Wij maken gebruik van dienstverleners (verwerkers), waaronder:`,
        "Met verwerkers sluiten wij verwerkersovereenkomsten. Doorgifte buiten de EER vindt alleen plaats met passende waarborgen (bijv. SCC’s) indien een leverancier dat vereist.",
      ],
      bullets: [
        "Supabase (database, auth, bestandsopslag voor chat-afbeeldingen);",
        "Vercel (hosting);",
        "Stripe (betalingen);",
        "Postmark (e-mail);",
        "xAI / Grok (AI-verwerking van chatcontext);",
        "Microsoft Clarity (analytics, indien actief).",
      ],
    },
    {
      id: "retention",
      title: "6. Bewaartermijnen",
      paragraphs: [
        "Account- en profielgegevens: zolang je account actief is, daarna verwijdering of anonimisering binnen 90 dagen, tenzij wettelijke bewaarplicht.",
        "Chatberichten: zolang je account bestaat of zolang nodig voor geschillen/misbruik-onderzoek (maximaal 2 jaar na laatste activiteit, tenzij eerder verwijderd).",
        "Betaaladministratie: tot 7 jaar (fiscale bewaarplicht).",
        "Marketingvoorkeuren: tot je je afmeldt of 2 jaar inactiviteit.",
        "Logs en analytics: doorgaans 12–26 maanden.",
      ],
    },
    {
      id: "rights",
      title: "7. Jouw rechten",
      paragraphs: [
        "Je hebt recht op inzage, rectificatie, verwijdering, beperking, dataportabiliteit en bezwaar (voor zover van toepassing). Voor verzoeken: " +
          LEGAL_CONTACT_EMAIL +
          ". Wij reageren binnen 1 maand.",
        "Je kunt een klacht indienen bij de Autoriteit Persoonsgegevens (AP): https://autoriteitpersoonsgegevens.nl",
        "Je kunt je account en gegevens laten verwijderen via de app of per e-mail.",
      ],
    },
    {
      id: "marketing",
      title: "8. E-mail en marketing",
      paragraphs: [
        "Transactie-e-mails (bijv. herinnering aan ongelezen bericht, bevestiging aankoop) zijn nodig voor de Dienst.",
        "Marketing-e-mails (acties, nieuws) sturen wij alleen met je toestemming. Elke marketingmail bevat een afmeldlink; je kunt ook mailen naar " +
          LEGAL_CONTACT_EMAIL +
          ".",
      ],
    },
    {
      id: "security",
      title: "9. Beveiliging",
      paragraphs: [
        "Wij nemen passende technische en organisatorische maatregelen (o.a. HTTPS, toegangsbeheer, row level security). Geen enkele dienst is 100% veilig.",
      ],
    },
    {
      id: "minors",
      title: "10. Minderjarigen",
      paragraphs: [
        "De Dienst is niet bedoeld voor personen onder 18 jaar. Ontdekken wij een account van een minderjarige, dan verwijderen wij het.",
      ],
    },
    {
      id: "changes",
      title: "11. Wijzigingen",
      paragraphs: [
        "Wij kunnen dit beleid aanpassen. De datum bovenaan geldt. Bij wezenlijke wijzigingen informeren wij je via de app of e-mail.",
      ],
    },
  ],
};
