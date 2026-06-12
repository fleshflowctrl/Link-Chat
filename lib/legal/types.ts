export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  subtitle?: string;
  lastUpdated: string;
  sections: LegalSection[];
};
