// Major world cities for shipping zone selection
// Users can also type any city not in this list (free-text supported)
export interface WorldCity {
  city: string;
  country: string;
  countryCode: string;
}

export const WORLD_CITIES: WorldCity[] = [
  // China
  { city: "Guangzhou", country: "Chine", countryCode: "CN" },
  { city: "Shenzhen", country: "Chine", countryCode: "CN" },
  { city: "Shanghai", country: "Chine", countryCode: "CN" },
  { city: "Beijing", country: "Chine", countryCode: "CN" },
  { city: "Yiwu", country: "Chine", countryCode: "CN" },
  { city: "Hangzhou", country: "Chine", countryCode: "CN" },
  { city: "Ningbo", country: "Chine", countryCode: "CN" },
  { city: "Dongguan", country: "Chine", countryCode: "CN" },
  { city: "Foshan", country: "Chine", countryCode: "CN" },
  { city: "Xiamen", country: "Chine", countryCode: "CN" },
  { city: "Qingdao", country: "Chine", countryCode: "CN" },
  { city: "Tianjin", country: "Chine", countryCode: "CN" },
  { city: "Dalian", country: "Chine", countryCode: "CN" },
  { city: "Chongqing", country: "Chine", countryCode: "CN" },
  { city: "Wuhan", country: "Chine", countryCode: "CN" },
  { city: "Chengdu", country: "Chine", countryCode: "CN" },
  { city: "Suzhou", country: "Chine", countryCode: "CN" },
  { city: "Nanjing", country: "Chine", countryCode: "CN" },
  { city: "Zhengzhou", country: "Chine", countryCode: "CN" },
  { city: "Xi'an", country: "Chine", countryCode: "CN" },
  { city: "Changsha", country: "Chine", countryCode: "CN" },
  { city: "Kunming", country: "Chine", countryCode: "CN" },
  { city: "Harbin", country: "Chine", countryCode: "CN" },
  { city: "Shenyang", country: "Chine", countryCode: "CN" },
  { city: "Fuzhou", country: "Chine", countryCode: "CN" },
  { city: "Wenzhou", country: "Chine", countryCode: "CN" },
  { city: "Zhuhai", country: "Chine", countryCode: "CN" },
  { city: "Hong Kong", country: "Hong Kong", countryCode: "HK" },
  { city: "Macao", country: "Macao", countryCode: "MO" },

  // DRC
  { city: "Kinshasa", country: "RD Congo", countryCode: "CD" },
  { city: "Lubumbashi", country: "RD Congo", countryCode: "CD" },
  { city: "Mbuji-Mayi", country: "RD Congo", countryCode: "CD" },
  { city: "Kisangani", country: "RD Congo", countryCode: "CD" },
  { city: "Goma", country: "RD Congo", countryCode: "CD" },
  { city: "Bukavu", country: "RD Congo", countryCode: "CD" },
  { city: "Matadi", country: "RD Congo", countryCode: "CD" },
  { city: "Likasi", country: "RD Congo", countryCode: "CD" },
  { city: "Kolwezi", country: "RD Congo", countryCode: "CD" },
  { city: "Kananga", country: "RD Congo", countryCode: "CD" },
  { city: "Boma", country: "RD Congo", countryCode: "CD" },
  { city: "Kikwit", country: "RD Congo", countryCode: "CD" },
  { city: "Butembo", country: "RD Congo", countryCode: "CD" },
  { city: "Tshikapa", country: "RD Congo", countryCode: "CD" },
  { city: "Bandundu", country: "RD Congo", countryCode: "CD" },
  { city: "Mbandaka", country: "RD Congo", countryCode: "CD" },
  { city: "Uvira", country: "RD Congo", countryCode: "CD" },
  { city: "Kalemie", country: "RD Congo", countryCode: "CD" },

  // USA
  { city: "New York", country: "États-Unis", countryCode: "US" },
  { city: "Los Angeles", country: "États-Unis", countryCode: "US" },
  { city: "Chicago", country: "États-Unis", countryCode: "US" },
  { city: "Miami", country: "États-Unis", countryCode: "US" },
  { city: "Houston", country: "États-Unis", countryCode: "US" },
  { city: "San Francisco", country: "États-Unis", countryCode: "US" },
  { city: "Seattle", country: "États-Unis", countryCode: "US" },
  { city: "Atlanta", country: "États-Unis", countryCode: "US" },
  { city: "Dallas", country: "États-Unis", countryCode: "US" },
  { city: "Boston", country: "États-Unis", countryCode: "US" },
  { city: "Denver", country: "États-Unis", countryCode: "US" },
  { city: "Phoenix", country: "États-Unis", countryCode: "US" },
  { city: "Las Vegas", country: "États-Unis", countryCode: "US" },
  { city: "Portland", country: "États-Unis", countryCode: "US" },
  { city: "Detroit", country: "États-Unis", countryCode: "US" },
  { city: "Philadelphia", country: "États-Unis", countryCode: "US" },
  { city: "Washington DC", country: "États-Unis", countryCode: "US" },

  // Canada
  { city: "Toronto", country: "Canada", countryCode: "CA" },
  { city: "Montréal", country: "Canada", countryCode: "CA" },
  { city: "Vancouver", country: "Canada", countryCode: "CA" },
  { city: "Calgary", country: "Canada", countryCode: "CA" },
  { city: "Ottawa", country: "Canada", countryCode: "CA" },

  // France
  { city: "Paris", country: "France", countryCode: "FR" },
  { city: "Marseille", country: "France", countryCode: "FR" },
  { city: "Lyon", country: "France", countryCode: "FR" },
  { city: "Le Havre", country: "France", countryCode: "FR" },
  { city: "Toulouse", country: "France", countryCode: "FR" },
  { city: "Nice", country: "France", countryCode: "FR" },
  { city: "Bordeaux", country: "France", countryCode: "FR" },
  { city: "Strasbourg", country: "France", countryCode: "FR" },
  { city: "Lille", country: "France", countryCode: "FR" },
  { city: "Nantes", country: "France", countryCode: "FR" },

  // UK
  { city: "Londres", country: "Royaume-Uni", countryCode: "GB" },
  { city: "Manchester", country: "Royaume-Uni", countryCode: "GB" },
  { city: "Birmingham", country: "Royaume-Uni", countryCode: "GB" },
  { city: "Liverpool", country: "Royaume-Uni", countryCode: "GB" },
  { city: "Glasgow", country: "Royaume-Uni", countryCode: "GB" },
  { city: "Edinburgh", country: "Royaume-Uni", countryCode: "GB" },

  // Belgium
  { city: "Anvers", country: "Belgique", countryCode: "BE" },
  { city: "Bruxelles", country: "Belgique", countryCode: "BE" },
  { city: "Liège", country: "Belgique", countryCode: "BE" },

  // Netherlands
  { city: "Rotterdam", country: "Pays-Bas", countryCode: "NL" },
  { city: "Amsterdam", country: "Pays-Bas", countryCode: "NL" },
  { city: "La Haye", country: "Pays-Bas", countryCode: "NL" },

  // Germany
  { city: "Hambourg", country: "Allemagne", countryCode: "DE" },
  { city: "Francfort", country: "Allemagne", countryCode: "DE" },
  { city: "Munich", country: "Allemagne", countryCode: "DE" },
  { city: "Berlin", country: "Allemagne", countryCode: "DE" },
  { city: "Düsseldorf", country: "Allemagne", countryCode: "DE" },
  { city: "Cologne", country: "Allemagne", countryCode: "DE" },
  { city: "Stuttgart", country: "Allemagne", countryCode: "DE" },

  // Italy
  { city: "Milan", country: "Italie", countryCode: "IT" },
  { city: "Rome", country: "Italie", countryCode: "IT" },
  { city: "Gênes", country: "Italie", countryCode: "IT" },
  { city: "Naples", country: "Italie", countryCode: "IT" },

  // Spain
  { city: "Madrid", country: "Espagne", countryCode: "ES" },
  { city: "Barcelone", country: "Espagne", countryCode: "ES" },
  { city: "Valence", country: "Espagne", countryCode: "ES" },
  { city: "Séville", country: "Espagne", countryCode: "ES" },

  // Portugal
  { city: "Lisbonne", country: "Portugal", countryCode: "PT" },
  { city: "Porto", country: "Portugal", countryCode: "PT" },

  // Turkey
  { city: "Istanbul", country: "Turquie", countryCode: "TR" },
  { city: "Ankara", country: "Turquie", countryCode: "TR" },
  { city: "Izmir", country: "Turquie", countryCode: "TR" },

  // Russia
  { city: "Moscou", country: "Russie", countryCode: "RU" },
  { city: "Saint-Pétersbourg", country: "Russie", countryCode: "RU" },
  { city: "Vladivostok", country: "Russie", countryCode: "RU" },

  // Poland
  { city: "Varsovie", country: "Pologne", countryCode: "PL" },
  { city: "Gdańsk", country: "Pologne", countryCode: "PL" },

  // Nordics
  { city: "Stockholm", country: "Suède", countryCode: "SE" },
  { city: "Copenhague", country: "Danemark", countryCode: "DK" },
  { city: "Helsinki", country: "Finlande", countryCode: "FI" },
  { city: "Oslo", country: "Norvège", countryCode: "NO" },

  // Switzerland / Austria
  { city: "Zurich", country: "Suisse", countryCode: "CH" },
  { city: "Genève", country: "Suisse", countryCode: "CH" },
  { city: "Vienne", country: "Autriche", countryCode: "AT" },

  // Greece
  { city: "Athènes", country: "Grèce", countryCode: "GR" },
  { city: "Le Pirée", country: "Grèce", countryCode: "GR" },

  // Africa - West
  { city: "Dakar", country: "Sénégal", countryCode: "SN" },
  { city: "Abidjan", country: "Côte d'Ivoire", countryCode: "CI" },
  { city: "Lagos", country: "Nigeria", countryCode: "NG" },
  { city: "Abuja", country: "Nigeria", countryCode: "NG" },
  { city: "Port Harcourt", country: "Nigeria", countryCode: "NG" },
  { city: "Accra", country: "Ghana", countryCode: "GH" },
  { city: "Tema", country: "Ghana", countryCode: "GH" },
  { city: "Lomé", country: "Togo", countryCode: "TG" },
  { city: "Cotonou", country: "Bénin", countryCode: "BJ" },
  { city: "Conakry", country: "Guinée", countryCode: "GN" },
  { city: "Bamako", country: "Mali", countryCode: "ML" },
  { city: "Ouagadougou", country: "Burkina Faso", countryCode: "BF" },
  { city: "Niamey", country: "Niger", countryCode: "NE" },
  { city: "Nouakchott", country: "Mauritanie", countryCode: "MR" },
  { city: "Freetown", country: "Sierra Leone", countryCode: "SL" },
  { city: "Monrovia", country: "Liberia", countryCode: "LR" },
  { city: "Banjul", country: "Gambie", countryCode: "GM" },
  { city: "Bissau", country: "Guinée-Bissau", countryCode: "GW" },
  { city: "Praia", country: "Cap-Vert", countryCode: "CV" },

  // Africa - Central
  { city: "Brazzaville", country: "Congo", countryCode: "CG" },
  { city: "Pointe-Noire", country: "Congo", countryCode: "CG" },
  { city: "Douala", country: "Cameroun", countryCode: "CM" },
  { city: "Yaoundé", country: "Cameroun", countryCode: "CM" },
  { city: "Libreville", country: "Gabon", countryCode: "GA" },
  { city: "Malabo", country: "Guinée Équatoriale", countryCode: "GQ" },
  { city: "Bangui", country: "Centrafrique", countryCode: "CF" },
  { city: "N'Djamena", country: "Tchad", countryCode: "TD" },
  { city: "São Tomé", country: "São Tomé-et-Príncipe", countryCode: "ST" },

  // Africa - East
  { city: "Dar es Salaam", country: "Tanzanie", countryCode: "TZ" },
  { city: "Mombasa", country: "Kenya", countryCode: "KE" },
  { city: "Nairobi", country: "Kenya", countryCode: "KE" },
  { city: "Kampala", country: "Ouganda", countryCode: "UG" },
  { city: "Kigali", country: "Rwanda", countryCode: "RW" },
  { city: "Bujumbura", country: "Burundi", countryCode: "BI" },
  { city: "Addis-Abeba", country: "Éthiopie", countryCode: "ET" },
  { city: "Djibouti", country: "Djibouti", countryCode: "DJ" },
  { city: "Mogadiscio", country: "Somalie", countryCode: "SO" },
  { city: "Asmara", country: "Érythrée", countryCode: "ER" },
  { city: "Antananarivo", country: "Madagascar", countryCode: "MG" },
  { city: "Port Louis", country: "Maurice", countryCode: "MU" },

  // Africa - Southern
  { city: "Johannesburg", country: "Afrique du Sud", countryCode: "ZA" },
  { city: "Le Cap", country: "Afrique du Sud", countryCode: "ZA" },
  { city: "Durban", country: "Afrique du Sud", countryCode: "ZA" },
  { city: "Pretoria", country: "Afrique du Sud", countryCode: "ZA" },
  { city: "Luanda", country: "Angola", countryCode: "AO" },
  { city: "Lobito", country: "Angola", countryCode: "AO" },
  { city: "Maputo", country: "Mozambique", countryCode: "MZ" },
  { city: "Lusaka", country: "Zambie", countryCode: "ZM" },
  { city: "Harare", country: "Zimbabwe", countryCode: "ZW" },
  { city: "Lilongwe", country: "Malawi", countryCode: "MW" },
  { city: "Windhoek", country: "Namibie", countryCode: "NA" },
  { city: "Gaborone", country: "Botswana", countryCode: "BW" },

  // Africa - North
  { city: "Casablanca", country: "Maroc", countryCode: "MA" },
  { city: "Tanger", country: "Maroc", countryCode: "MA" },
  { city: "Tunis", country: "Tunisie", countryCode: "TN" },
  { city: "Le Caire", country: "Égypte", countryCode: "EG" },
  { city: "Alexandrie", country: "Égypte", countryCode: "EG" },
  { city: "Alger", country: "Algérie", countryCode: "DZ" },
  { city: "Oran", country: "Algérie", countryCode: "DZ" },
  { city: "Tripoli", country: "Libye", countryCode: "LY" },
  { city: "Khartoum", country: "Soudan", countryCode: "SD" },

  // Middle East
  { city: "Dubaï", country: "EAU", countryCode: "AE" },
  { city: "Abu Dhabi", country: "EAU", countryCode: "AE" },
  { city: "Sharjah", country: "EAU", countryCode: "AE" },
  { city: "Djeddah", country: "Arabie Saoudite", countryCode: "SA" },
  { city: "Riyad", country: "Arabie Saoudite", countryCode: "SA" },
  { city: "Dammam", country: "Arabie Saoudite", countryCode: "SA" },
  { city: "Doha", country: "Qatar", countryCode: "QA" },
  { city: "Koweït City", country: "Koweït", countryCode: "KW" },
  { city: "Manama", country: "Bahreïn", countryCode: "BH" },
  { city: "Mascate", country: "Oman", countryCode: "OM" },
  { city: "Beyrouth", country: "Liban", countryCode: "LB" },
  { city: "Amman", country: "Jordanie", countryCode: "JO" },
  { city: "Bagdad", country: "Irak", countryCode: "IQ" },
  { city: "Téhéran", country: "Iran", countryCode: "IR" },

  // South Asia
  { city: "Mumbai", country: "Inde", countryCode: "IN" },
  { city: "Delhi", country: "Inde", countryCode: "IN" },
  { city: "Chennai", country: "Inde", countryCode: "IN" },
  { city: "Bangalore", country: "Inde", countryCode: "IN" },
  { city: "Kolkata", country: "Inde", countryCode: "IN" },
  { city: "Hyderabad", country: "Inde", countryCode: "IN" },
  { city: "Ahmedabad", country: "Inde", countryCode: "IN" },
  { city: "Colombo", country: "Sri Lanka", countryCode: "LK" },
  { city: "Karachi", country: "Pakistan", countryCode: "PK" },
  { city: "Lahore", country: "Pakistan", countryCode: "PK" },
  { city: "Dhaka", country: "Bangladesh", countryCode: "BD" },
  { city: "Katmandou", country: "Népal", countryCode: "NP" },

  // Southeast Asia
  { city: "Singapour", country: "Singapour", countryCode: "SG" },
  { city: "Bangkok", country: "Thaïlande", countryCode: "TH" },
  { city: "Hô-Chi-Minh-Ville", country: "Vietnam", countryCode: "VN" },
  { city: "Hanoï", country: "Vietnam", countryCode: "VN" },
  { city: "Jakarta", country: "Indonésie", countryCode: "ID" },
  { city: "Surabaya", country: "Indonésie", countryCode: "ID" },
  { city: "Kuala Lumpur", country: "Malaisie", countryCode: "MY" },
  { city: "Manille", country: "Philippines", countryCode: "PH" },
  { city: "Phnom Penh", country: "Cambodge", countryCode: "KH" },
  { city: "Rangoun", country: "Myanmar", countryCode: "MM" },
  { city: "Vientiane", country: "Laos", countryCode: "LA" },

  // East Asia
  { city: "Tokyo", country: "Japon", countryCode: "JP" },
  { city: "Osaka", country: "Japon", countryCode: "JP" },
  { city: "Yokohama", country: "Japon", countryCode: "JP" },
  { city: "Nagoya", country: "Japon", countryCode: "JP" },
  { city: "Séoul", country: "Corée du Sud", countryCode: "KR" },
  { city: "Busan", country: "Corée du Sud", countryCode: "KR" },
  { city: "Taipei", country: "Taïwan", countryCode: "TW" },
  { city: "Kaohsiung", country: "Taïwan", countryCode: "TW" },
  { city: "Oulan-Bator", country: "Mongolie", countryCode: "MN" },

  // Oceania
  { city: "Sydney", country: "Australie", countryCode: "AU" },
  { city: "Melbourne", country: "Australie", countryCode: "AU" },
  { city: "Brisbane", country: "Australie", countryCode: "AU" },
  { city: "Perth", country: "Australie", countryCode: "AU" },
  { city: "Auckland", country: "Nouvelle-Zélande", countryCode: "NZ" },
  { city: "Wellington", country: "Nouvelle-Zélande", countryCode: "NZ" },

  // South America
  { city: "São Paulo", country: "Brésil", countryCode: "BR" },
  { city: "Rio de Janeiro", country: "Brésil", countryCode: "BR" },
  { city: "Santos", country: "Brésil", countryCode: "BR" },
  { city: "Buenos Aires", country: "Argentine", countryCode: "AR" },
  { city: "Santiago", country: "Chili", countryCode: "CL" },
  { city: "Lima", country: "Pérou", countryCode: "PE" },
  { city: "Bogotá", country: "Colombie", countryCode: "CO" },
  { city: "Medellín", country: "Colombie", countryCode: "CO" },
  { city: "Caracas", country: "Venezuela", countryCode: "VE" },
  { city: "Quito", country: "Équateur", countryCode: "EC" },
  { city: "Guayaquil", country: "Équateur", countryCode: "EC" },
  { city: "Montevideo", country: "Uruguay", countryCode: "UY" },
  { city: "Asunción", country: "Paraguay", countryCode: "PY" },
  { city: "La Paz", country: "Bolivie", countryCode: "BO" },

  // Central America & Caribbean
  { city: "Panama City", country: "Panama", countryCode: "PA" },
  { city: "Mexico City", country: "Mexique", countryCode: "MX" },
  { city: "Guadalajara", country: "Mexique", countryCode: "MX" },
  { city: "Monterrey", country: "Mexique", countryCode: "MX" },
  { city: "San José", country: "Costa Rica", countryCode: "CR" },
  { city: "Guatemala City", country: "Guatemala", countryCode: "GT" },
  { city: "La Havane", country: "Cuba", countryCode: "CU" },
  { city: "Saint-Domingue", country: "République Dominicaine", countryCode: "DO" },
  { city: "Port-au-Prince", country: "Haïti", countryCode: "HT" },
  { city: "Kingston", country: "Jamaïque", countryCode: "JM" },

  // Central Asia
  { city: "Tachkent", country: "Ouzbékistan", countryCode: "UZ" },
  { city: "Almaty", country: "Kazakhstan", countryCode: "KZ" },
  { city: "Bakou", country: "Azerbaïdjan", countryCode: "AZ" },
  { city: "Tbilissi", country: "Géorgie", countryCode: "GE" },
];
