// Correspondance nom de pays (anglais, tel que renvoyé par Grizzly) -> code ISO
// alpha-2, pour afficher le bon drapeau. Recherche normalisée (minuscules,
// sans accents). Pays non listé -> pas de drapeau (dégradation propre).

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

const NAME_ISO: Record<string, string> = {
  russia: "ru", ukraine: "ua", kazakhstan: "kz", china: "cn", philippines: "ph",
  myanmar: "mm", indonesia: "id", malaysia: "my", kenya: "ke", tanzania: "tz",
  vietnam: "vn", kyrgyzstan: "kg", unitedstates: "us", usa: "us", israel: "il",
  hongkong: "hk", poland: "pl", england: "gb", unitedkingdom: "gb", uk: "gb",
  madagascar: "mg", drcongo: "cd", congo: "cg", nigeria: "ng", macau: "mo",
  egypt: "eg", india: "in", ireland: "ie", cambodia: "kh", laos: "la",
  haiti: "ht", ivorycoast: "ci", cotedivoire: "ci", gambia: "gm", serbia: "rs",
  yemen: "ye", southafrica: "za", romania: "ro", colombia: "co", estonia: "ee",
  azerbaijan: "az", canada: "ca", morocco: "ma", ghana: "gh", argentina: "ar",
  uzbekistan: "uz", cameroon: "cm", chad: "td", germany: "de", lithuania: "lt",
  croatia: "hr", sweden: "se", iraq: "iq", netherlands: "nl", latvia: "lv",
  austria: "at", belarus: "by", thailand: "th", saudiarabia: "sa", mexico: "mx",
  taiwan: "tw", spain: "es", iran: "ir", algeria: "dz", slovenia: "si",
  bangladesh: "bd", senegal: "sn", turkey: "tr", turkiye: "tr", czechrepublic: "cz",
  srilanka: "lk", peru: "pe", pakistan: "pk", newzealand: "nz", guinea: "gn",
  mali: "ml", venezuela: "ve", ethiopia: "et", mongolia: "mn", brazil: "br",
  afghanistan: "af", uganda: "ug", angola: "ao", cyprus: "cy", france: "fr",
  papuanewguinea: "pg", mozambique: "mz", nepal: "np", belgium: "be",
  bulgaria: "bg", hungary: "hu", moldova: "md", italy: "it", paraguay: "py",
  honduras: "hn", tunisia: "tn", nicaragua: "ni", timorleste: "tl", bolivia: "bo",
  costarica: "cr", guatemala: "gt", uruguay: "uy", zambia: "zm", cuba: "cu",
  bosniaandherzegovina: "ba", benin: "bj", zimbabwe: "zw", togo: "tg",
  saintlucia: "lc", southkorea: "kr", korea: "kr", denmark: "dk", norway: "no",
  finland: "fi", switzerland: "ch", portugal: "pt", greece: "gr", jordan: "jo",
  qatar: "qa", bahrain: "bh", oman: "om", kuwait: "kw", lebanon: "lb",
  unitedarabemirates: "ae", uae: "ae", singapore: "sg", japan: "jp",
  australia: "au", chile: "cl", ecuador: "ec", elsalvador: "sv", panama: "pa",
  dominicanrepublic: "do", jamaica: "jm", barbados: "bb", bahamas: "bs",
  trinidadandtobago: "tt", suriname: "sr", guyana: "gy", syria: "sy",
  georgia: "ge", armenia: "am", tajikistan: "tj", turkmenistan: "tm",
  albania: "al", northmacedonia: "mk", macedonia: "mk", montenegro: "me",
  kosovo: "xk", iceland: "is", luxembourg: "lu", malta: "mt", slovakia: "sk",
  rwanda: "rw", burundi: "bi", somalia: "so", sudan: "sd", southsudan: "ss",
  libya: "ly", mauritania: "mr", nigerrepublic: "ne", niger: "ne",
  burkinafaso: "bf", sierraleone: "sl", liberia: "lr", gabon: "ga",
  botswana: "bw", namibia: "na", malawi: "mw", lesotho: "ls", eswatini: "sz",
  mauritius: "mu", djibouti: "dj", comoros: "km", capeverde: "cv",
  seychelles: "sc", brunei: "bn", maldives: "mv", bhutan: "bt", fiji: "fj",
  centralafricanrepublic: "cf", equatorialguinea: "gq", guineabissau: "gw",
};

export function isoFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  return NAME_ISO[norm(name)] ?? null;
}

/** URL d'un petit drapeau (flagcdn) — fiable sur tous les appareils. */
export function flagUrl(iso: string | null): string | null {
  return iso ? `https://flagcdn.com/w40/${iso}.png` : null;
}
