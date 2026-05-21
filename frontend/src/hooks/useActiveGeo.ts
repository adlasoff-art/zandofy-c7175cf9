/**
 * Hook to fetch active countries from platform_settings
 * and provide filtering for geographic selectors.
 */
import { useBootstrapSetting } from "@/hooks/use-platform-bootstrap";

const COUNTRY_MAP: Record<string, string> = {
  AF:"Afghanistan",AL:"Albanie",DZ:"Algérie",AD:"Andorre",AO:"Angola",AG:"Antigua-et-Barbuda",AR:"Argentine",AM:"Arménie",AU:"Australie",AT:"Autriche",AZ:"Azerbaïdjan",BS:"Bahamas",BH:"Bahreïn",BD:"Bangladesh",BB:"Barbade",BY:"Biélorussie",BE:"Belgique",BZ:"Belize",BJ:"Bénin",BT:"Bhoutan",BO:"Bolivie",BA:"Bosnie-Herzégovine",BW:"Botswana",BR:"Brésil",BN:"Brunei",BG:"Bulgarie",BF:"Burkina Faso",BI:"Burundi",KH:"Cambodge",CM:"Cameroun",CA:"Canada",CV:"Cap-Vert",CF:"Centrafrique",TD:"Tchad",CL:"Chili",CN:"Chine",CO:"Colombie",KM:"Comores",CG:"Congo",CD:"RD Congo",CR:"Costa Rica",CI:"Côte d'Ivoire",HR:"Croatie",CU:"Cuba",CY:"Chypre",CZ:"Tchéquie",DK:"Danemark",DJ:"Djibouti",DM:"Dominique",DO:"Rép. dominicaine",EC:"Équateur",EG:"Égypte",SV:"Salvador",GQ:"Guinée équatoriale",ER:"Érythrée",EE:"Estonie",SZ:"Eswatini",ET:"Éthiopie",FJ:"Fidji",FI:"Finlande",FR:"France",GA:"Gabon",GM:"Gambie",GE:"Géorgie",DE:"Allemagne",GH:"Ghana",GR:"Grèce",GD:"Grenade",GT:"Guatemala",GN:"Guinée",GW:"Guinée-Bissau",GY:"Guyana",HT:"Haïti",HN:"Honduras",HU:"Hongrie",IS:"Islande",IN:"Inde",ID:"Indonésie",IR:"Iran",IQ:"Irak",IE:"Irlande",IL:"Israël",IT:"Italie",JM:"Jamaïque",JP:"Japon",JO:"Jordanie",KZ:"Kazakhstan",KE:"Kenya",KI:"Kiribati",KP:"Corée du Nord",KR:"Corée du Sud",KW:"Koweït",KG:"Kirghizistan",LA:"Laos",LV:"Lettonie",LB:"Liban",LS:"Lesotho",LR:"Liberia",LY:"Libye",LI:"Liechtenstein",LT:"Lituanie",LU:"Luxembourg",MG:"Madagascar",MW:"Malawi",MY:"Malaisie",MV:"Maldives",ML:"Mali",MT:"Malte",MH:"Îles Marshall",MR:"Mauritanie",MU:"Maurice",MX:"Mexique",FM:"Micronésie",MD:"Moldavie",MC:"Monaco",MN:"Mongolie",ME:"Monténégro",MA:"Maroc",MZ:"Mozambique",MM:"Myanmar",NA:"Namibie",NR:"Nauru",NP:"Népal",NL:"Pays-Bas",NZ:"Nouvelle-Zélande",NI:"Nicaragua",NE:"Niger",NG:"Nigeria",MK:"Macédoine du Nord",NO:"Norvège",OM:"Oman",PK:"Pakistan",PW:"Palaos",PA:"Panama",PG:"Papouasie-Nouvelle-Guinée",PY:"Paraguay",PE:"Pérou",PH:"Philippines",PL:"Pologne",PT:"Portugal",QA:"Qatar",RO:"Roumanie",RU:"Russie",RW:"Rwanda",KN:"Saint-Kitts-et-Nevis",LC:"Sainte-Lucie",VC:"Saint-Vincent",WS:"Samoa",SM:"Saint-Marin",ST:"São Tomé-et-Príncipe",SA:"Arabie saoudite",SN:"Sénégal",RS:"Serbie",SC:"Seychelles",SL:"Sierra Leone",SG:"Singapour",SK:"Slovaquie",SI:"Slovénie",SB:"Îles Salomon",SO:"Somalie",ZA:"Afrique du Sud",SS:"Soudan du Sud",ES:"Espagne",LK:"Sri Lanka",SD:"Soudan",SR:"Suriname",SE:"Suède",CH:"Suisse",SY:"Syrie",TW:"Taïwan",TJ:"Tadjikistan",TZ:"Tanzanie",TH:"Thaïlande",TL:"Timor oriental",TG:"Togo",TO:"Tonga",TT:"Trinité-et-Tobago",TN:"Tunisie",TR:"Turquie",TM:"Turkménistan",TV:"Tuvalu",UG:"Ouganda",UA:"Ukraine",AE:"Émirats arabes unis",GB:"Royaume-Uni",US:"États-Unis",UY:"Uruguay",UZ:"Ouzbékistan",VU:"Vanuatu",VE:"Venezuela",VN:"Vietnam",YE:"Yémen",ZM:"Zambie",ZW:"Zimbabwe"
};

interface UseActiveGeoReturn {
  activeCountryCodes: string[];
  disabledCountryCodes: string[];
  isCountryActive: (code: string) => boolean;
  loading: boolean;
}

export function useActiveGeo(): UseActiveGeoReturn {
  const { value, isLoading } = useBootstrapSetting<any>("active_countries");
  const disabledCodes: string[] =
    value?.disabled && Array.isArray(value.disabled) ? value.disabled : [];

  const allCodes = Object.keys(COUNTRY_MAP);
  const disabledSet = new Set(disabledCodes);
  const activeCodes = allCodes.filter(c => !disabledSet.has(c));

  return {
    activeCountryCodes: activeCodes,
    disabledCountryCodes: disabledCodes,
    isCountryActive: (code: string) => !disabledSet.has(code),
    loading: isLoading,
  };
}
