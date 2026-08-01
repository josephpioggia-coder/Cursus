// src/i18n/index.js
// Initialisation i18next — à importer une seule fois dans main.jsx :
//   import "./i18n";
//
// Langue : PAR PROJET (pas par compte). Le composant racine doit appeler
// i18n.changeLanguage(projet.langue || "fr") au chargement du projet actif.

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import commonFr from "./locales/fr/common.json";
import editeurFr from "./locales/fr/editeur.json";
import copiloteFr from "./locales/fr/copilote.json";
import adnFr from "./locales/fr/adn.json";
import paliersFr from "./locales/fr/paliers.json";

import commonEn from "./locales/en/common.json";
import editeurEn from "./locales/en/editeur.json";
import copiloteEn from "./locales/en/copilote.json";
import adnEn from "./locales/en/adn.json";
import paliersEn from "./locales/en/paliers.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "fr",
    lng: "fr", // langue par défaut avant que le projet actif ne soit connu
    debug: false,
    resources: {
      fr: {
        common: commonFr,
        editeur: editeurFr,
        copilote: copiloteFr,
        adn: adnFr,
        paliers: paliersFr,
      },
      en: {
        common: commonEn,
        editeur: editeurEn,
        copilote: copiloteEn,
        adn: adnEn,
        paliers: paliersEn,
      },
    },
    ns: ["common", "editeur", "copilote", "adn", "paliers"],
    defaultNS: "common",
    interpolation: { escapeValue: false }, // React échappe déjà
  });

export default i18n;
