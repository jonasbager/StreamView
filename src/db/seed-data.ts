import type { Product, Provider, Service } from './schema'

/**
 * Starting catalog for Denmark (kr. per month). These are approximate and not
 * verified (verifiedAt = null); the weekly price job replaces them with live
 * prices after an admin approves the changes.
 */

type S = Omit<Service, 'sort'>
type P = Omit<Product, 'updatedAt' | 'verifiedAt' | 'active' | 'offerEndsAt' | 'sourceUrl' | 'offerText' | 'introPrice' | 'introMonths' | 'setupFee' | 'bindingMonths' | 'attributes' | 'includes'> &
  Partial<Pick<Product, 'introPrice' | 'introMonths' | 'setupFee' | 'bindingMonths' | 'attributes' | 'includes' | 'offerText'>>

export const SERVICES: S[] = [
  {
    id: 'netflix', name: 'Netflix', category: 'video', color: '#d81f26', capacityType: 'streams', url: 'https://www.netflix.com/dk/',
    sharing: {
      householdOnly: true, enforcement: 'strict',
      howEnforced: 'Netflix finder din husstand ud fra tv og enheder på dit hjemmenetværk. Enheder, der bruges et andet sted, bliver blokeret eller bedt om en kode. Håndhævet i Danmark siden 2023.',
      officialSharing: 'Køb et "ekstra medlem" til en uden for hjemmet: eget login og én stream. Standard giver 1 plads, Premium giver 2.',
    },
  },
  {
    id: 'disney', name: 'Disney+', category: 'video', color: '#0e3fa8', capacityType: 'streams', url: 'https://www.disneyplus.com/da-dk',
    sharing: {
      householdOnly: true, enforcement: 'high',
      howEnforced: 'Disney+ har indført betalt deling i 2024–25. Kontoen tjekker, hvor den bruges, og beder andre husstande om at betale for et ekstra medlem eller tegne eget abonnement.',
      officialSharing: 'Ekstra medlem mod betaling, hvor det tilbydes. Årsbetaling giver cirka 2 måneder gratis.',
    },
  },
  {
    id: 'hbomax', name: 'HBO Max', category: 'video', color: '#4b2a9a', capacityType: 'streams', url: 'https://www.hbomax.com/dk/da',
    sharing: {
      householdOnly: true, enforcement: 'medium',
      howEnforced: 'HBO Max begyndte at slå ned på kodeord-deling i 2025 med advarsler til kontoejeren. Et betalt "ekstra medlem" rulles ud marked for marked.',
      officialSharing: 'Én husstand pr. abonnement.',
    },
  },
  {
    id: 'viaplay', name: 'Viaplay', category: 'sport', color: '#e0244f', capacityType: 'streams', url: 'https://viaplay.dk',
    sharing: {
      householdOnly: true, enforcement: 'medium',
      howEnforced: 'Vilkårene begrænser kontoen til én husstand. Viaplay begrænser antal registrerede enheder og samtidige streams, især på sportspakkerne.',
      officialSharing: 'Ingen. Hver husstand skal have sit eget abonnement.',
    },
  },
  {
    id: 'viaplaysport', name: 'Viaplay Sport', category: 'sport', color: '#b01b3f', capacityType: 'streams', url: 'https://viaplay.dk',
    sharing: {
      householdOnly: true, enforcement: 'medium',
      howEnforced: 'Sportspakkerne har de strammeste tjek hos Viaplay: begrænsede enheder og samtidige streams.',
      officialSharing: 'Ingen. Kræver Viaplay Total eller en sportspakke.',
    },
  },
  {
    id: 'tv2play', name: 'TV 2 Play', category: 'video', color: '#0b5cc2', capacityType: 'streams', url: 'https://play.tv2.dk',
    sharing: {
      householdOnly: true, enforcement: 'low',
      howEnforced: 'Vilkårene siger én husstand, men i praksis begrænses kun antal samtidige streams og dansk IP-adresse.',
      officialSharing: 'Ingen. Én husstand pr. abonnement.',
    },
  },
  {
    id: 'tv2sport', name: 'TV 2 Sport', category: 'sport', color: '#083f87', capacityType: 'streams', url: 'https://play.tv2.dk',
    sharing: {
      householdOnly: true, enforcement: 'low',
      howEnforced: 'Som TV 2 Play: begrænset af samtidige streams og dansk IP-adresse.',
      officialSharing: 'Ingen. Kræver TV 2 Play med Sport.',
    },
  },
  {
    id: 'skyshowtime', name: 'SkyShowtime', category: 'video', color: '#0390c9', capacityType: 'streams', url: 'https://www.skyshowtime.com/dk',
    sharing: {
      householdOnly: true, enforcement: 'low',
      howEnforced: 'Vilkårene siger én husstand. Ingen kendte aktive tjek, kun en grænse for samtidige streams.',
      officialSharing: 'Ingen.',
    },
  },
  {
    id: 'prime', name: 'Prime Video', category: 'video', color: '#1a8fe0', capacityType: 'streams', url: 'https://www.primevideo.com',
    sharing: {
      householdOnly: true, enforcement: 'low',
      howEnforced: 'Op til 3 samtidige streams. Amazon tjekker ikke aktivt, hvor kontoen bruges.',
      officialSharing: 'Profiler inden for én husstand.',
    },
  },
  {
    id: 'appletv', name: 'Apple TV', category: 'video', color: '#5f5f64', capacityType: 'seats', url: 'https://tv.apple.com/dk',
    sharing: {
      householdOnly: false, enforcement: 'none',
      howEnforced: 'Ingen husstandstjek. Familiedeling er officielt tilladt, også på tværs af adresser.',
      officialSharing: 'Familiedeling for op til 6 personer med hvert sit Apple-login.',
    },
  },
  {
    id: 'drtv', name: 'DR TV', category: 'free', color: '#c8161d', capacityType: 'seats', url: 'https://www.dr.dk/drtv',
    sharing: { householdOnly: false, enforcement: 'none', howEnforced: 'Gratis for alle.', officialSharing: 'Alle kan oprette eget login.' },
  },
  {
    id: 'spotify', name: 'Spotify', category: 'music', color: '#1aa34a', capacityType: 'seats', url: 'https://www.spotify.com/dk-da/premium/',
    sharing: {
      householdOnly: true, enforcement: 'medium',
      howEnforced: 'Duo- og Family-medlemmer skal bo på samme adresse. Spotify beder om adressen og kan tjekke den igen senere.',
      officialSharing: 'Duo til 2 og Family til op til 6 på samme adresse. Rabat til studerende.',
    },
  },
  {
    id: 'youtube', name: 'YouTube Premium', category: 'music', color: '#e62117', capacityType: 'seats', url: 'https://www.youtube.com/premium',
    sharing: {
      householdOnly: true, enforcement: 'high',
      howEnforced: 'Familiemedlemmer skal bo i samme husstand. Google tjekker placering cirka hver 30. dag og sætter medlemmer på pause.',
      officialSharing: 'Family-plan til ejeren plus 5 i samme husstand.',
    },
  },
  {
    id: 'applemusic', name: 'Apple Music', category: 'music', color: '#e8344e', capacityType: 'seats', url: 'https://www.apple.com/dk/apple-music/',
    sharing: {
      householdOnly: false, enforcement: 'none',
      howEnforced: 'Ingen adressetjek. Familiedeling er officielt tilladt.',
      officialSharing: 'Family-plan til op til 6 personer med hvert sit login.',
    },
  },
]

const sp = (id: string, name: string, color: string, url: string): Provider => ({
  id, name, kind: 'streaming', color, url, priceUrls: [url], offers: [],
})
const tp = (id: string, name: string, color: string, url: string, offers: Provider['offers']): Provider => ({
  id, name, kind: 'telco', color, url, priceUrls: [url], offers,
})

export const PROVIDERS: Provider[] = [
  ...SERVICES.filter((s) => !['viaplaysport', 'tv2sport'].includes(s.id)).map((s) => sp(s.id, s.name, s.color, s.url)),
  { ...sp('apple', 'Apple', '#5f5f64', 'https://www.apple.com/dk/apple-one/'), priceUrls: ['https://www.apple.com/dk/apple-one/'] },
  tp('yousee', 'YouSee', '#00a3a0', 'https://yousee.dk', ['mobile', 'broadband', 'tv']),
  tp('telmore', 'Telmore', '#ff6a13', 'https://www.telmore.dk', ['mobile', 'broadband']),
  tp('norlys', 'Norlys', '#0d3b66', 'https://norlys.dk', ['mobile', 'broadband', 'tv']),
  tp('telia', 'Telia', '#990ae3', 'https://www.telia.dk', ['mobile', 'broadband']),
  tp('telenor', 'Telenor', '#0a8bd6', 'https://www.telenor.dk', ['mobile', 'broadband']),
  tp('3', '3', '#e2007a', 'https://www.3.dk', ['mobile', 'broadband']),
  tp('cbb', 'CBB', '#e30613', 'https://www.cbb.dk', ['mobile']),
  tp('oister', 'Oister', '#7ac143', 'https://www.oister.dk', ['mobile', 'broadband']),
  tp('lebara', 'Lebara', '#2d2a74', 'https://www.lebara.dk', ['mobile']),
  tp('hiper', 'Hiper', '#ff3c00', 'https://www.hiper.dk', ['broadband']),
  tp('fullrate', 'Fullrate', '#e50050', 'https://www.fullrate.dk', ['broadband']),
  tp('waoo', 'Waoo', '#00a6e2', 'https://www.waoo.dk', ['broadband', 'tv']),
]

const stream = (id: string, providerId: string, name: string, price: number, capacity: number, attributes: P['attributes'] = {}): P => ({
  id, providerId, name, category: 'streaming', price, includes: [{ serviceId: providerId, capacity }], attributes,
})

export const PRODUCTS: P[] = [
  stream('netflix-ads', 'netflix', 'Standard med reklamer', 69, 2, { ads: true }),
  stream('netflix-standard', 'netflix', 'Standard', 129, 2, { extraMember: { price: 49, slots: 1 } }),
  stream('netflix-premium', 'netflix', 'Premium', 179, 4, { extraMember: { price: 49, slots: 2 } }),
  stream('disney-ads', 'disney', 'Standard med reklamer', 69, 2, { ads: true }),
  stream('disney-standard', 'disney', 'Standard', 99, 2, { annualPrice: 990 }),
  stream('disney-premium', 'disney', 'Premium', 139, 4, { annualPrice: 1390 }),
  stream('hbomax-basic', 'hbomax', 'Basis med reklamer', 69, 2, { ads: true }),
  stream('hbomax-standard', 'hbomax', 'Standard', 109, 2, { annualPrice: 1090 }),
  stream('hbomax-premium', 'hbomax', 'Premium', 149, 4, { annualPrice: 1490 }),
  stream('viaplay-film', 'viaplay', 'Film & Serier', 149, 2),
  { ...stream('viaplay-total', 'viaplay', 'Total (inkl. sport)', 449, 2), includes: [{ serviceId: 'viaplay', capacity: 2 }, { serviceId: 'viaplaysport', capacity: 2 }] },
  stream('tv2play-basis', 'tv2play', 'Basis med reklamer', 99, 2, { ads: true }),
  stream('tv2play-favorit', 'tv2play', 'Favorit med reklamer', 149, 2, { ads: true }),
  stream('tv2play-favorit-noads', 'tv2play', 'Favorit uden reklamer', 199, 2),
  { ...stream('tv2play-sport', 'tv2play', 'Favorit + Sport', 249, 2, { ads: true }), includes: [{ serviceId: 'tv2play', capacity: 2 }, { serviceId: 'tv2sport', capacity: 2 }] },
  stream('skyshowtime-ads', 'skyshowtime', 'Standard med reklamer', 49, 2, { ads: true }),
  stream('skyshowtime-standard', 'skyshowtime', 'Standard', 69, 2, { annualPrice: 690 }),
  stream('skyshowtime-premium', 'skyshowtime', 'Premium', 99, 3),
  stream('prime-ads', 'prime', 'Prime Video med reklamer', 59, 3, { ads: true }),
  stream('prime-noads', 'prime', 'Prime Video uden reklamer', 79, 3),
  stream('appletv-std', 'appletv', 'Apple TV', 99, 6),
  stream('drtv-free', 'drtv', 'Gratis', 0, 99),
  stream('spotify-individual', 'spotify', 'Individual', 119, 1),
  stream('spotify-student', 'spotify', 'Student', 65, 1, { requires: 'student' }),
  stream('spotify-duo', 'spotify', 'Duo', 159, 2),
  stream('spotify-family', 'spotify', 'Family', 189, 6),
  stream('youtube-individual', 'youtube', 'Individual', 99, 1),
  stream('youtube-family', 'youtube', 'Family', 199, 6),
  stream('applemusic-individual', 'applemusic', 'Individual', 109, 1),
  stream('applemusic-student', 'applemusic', 'Student', 59, 1, { requires: 'student' }),
  stream('applemusic-family', 'applemusic', 'Family', 169, 6),
  {
    id: 'appleone-individual', providerId: 'apple', name: 'Apple One Individual', category: 'bundle', price: 129,
    includes: [{ serviceId: 'appletv', capacity: 1 }, { serviceId: 'applemusic', capacity: 1 }],
    offerText: 'Inkl. Apple Arcade og 50 GB iCloud+.',
  },
  {
    id: 'appleone-family', providerId: 'apple', name: 'Apple One Family', category: 'bundle', price: 179,
    includes: [{ serviceId: 'appletv', capacity: 6 }, { serviceId: 'applemusic', capacity: 6 }],
    offerText: 'Inkl. Arcade og 200 GB iCloud+. Familiedeling til 6 i alle hjem.',
  },

  // Mobile (one line each unless `lines` says otherwise).
  { id: 'telmore-mobil-50', providerId: 'telmore', name: 'Fri tale + 50 GB', category: 'mobile', price: 119, attributes: { dataGb: 50 } },
  { id: 'cbb-mobil-60', providerId: 'cbb', name: 'Fri tale + 60 GB', category: 'mobile', price: 109, attributes: { dataGb: 60 } },
  { id: 'lebara-mobil-40', providerId: 'lebara', name: 'Fri tale + 40 GB', category: 'mobile', price: 79, attributes: { dataGb: 40 } },
  { id: 'oister-mobil-100', providerId: 'oister', name: 'Fri tale + 100 GB', category: 'mobile', price: 129, attributes: { dataGb: 100 } },
  { id: '3-mobil-fri', providerId: '3', name: 'Fri tale + fri data', category: 'mobile', price: 199, attributes: { dataGb: -1 } },
  { id: 'telia-mobil-fri', providerId: 'telia', name: 'Fri tale + fri data', category: 'mobile', price: 229, attributes: { dataGb: -1 } },
  { id: 'yousee-mobil-100', providerId: 'yousee', name: 'Mobil 100 GB', category: 'mobile', price: 179, attributes: { dataGb: 100 } },
  { id: 'telenor-mobil-50', providerId: 'telenor', name: 'Fri tale + 50 GB', category: 'mobile', price: 149, attributes: { dataGb: 50 } },
  { id: 'norlys-mobil-50', providerId: 'norlys', name: 'Fri tale + 50 GB', category: 'mobile', price: 139, attributes: { dataGb: 50 } },

  // Broadband (per household).
  { id: 'hiper-fiber-1000', providerId: 'hiper', name: 'Fiber 1000/1000', category: 'broadband', price: 299, attributes: { speedMbit: 1000 } },
  { id: 'fullrate-500', providerId: 'fullrate', name: 'Bredbånd 500 Mbit', category: 'broadband', price: 249, attributes: { speedMbit: 500 } },
  { id: 'yousee-fiber-1000', providerId: 'yousee', name: 'Fiber 1000 Mbit', category: 'broadband', price: 349, attributes: { speedMbit: 1000 } },
  { id: 'norlys-fiber-1000', providerId: 'norlys', name: 'Fiber 1000 Mbit', category: 'broadband', price: 329, attributes: { speedMbit: 1000 } },
  { id: 'waoo-fiber-1000', providerId: 'waoo', name: 'Fiber 1000/1000', category: 'broadband', price: 339, attributes: { speedMbit: 1000 } },
  { id: 'telmore-5g', providerId: 'telmore', name: '5G mobilt bredbånd', category: 'broadband', price: 199, attributes: { speedMbit: 300 } },

  // TV packages (per household).
  { id: 'yousee-tv-lille', providerId: 'yousee', name: 'TV-pakke Lille', category: 'tv', price: 199 },
  { id: 'norlys-tv-grund', providerId: 'norlys', name: 'TV Grundpakke', category: 'tv', price: 189 },
  { id: 'waoo-tv-bland', providerId: 'waoo', name: 'Bland selv TV', category: 'tv', price: 299 },

  // Telco streaming bundles.
  {
    id: 'telmore-play', providerId: 'telmore', name: 'Telmore Play', category: 'bundle', price: 299,
    includes: [{ serviceId: 'netflix', capacity: 2 }, { serviceId: 'tv2play', capacity: 2 }],
    offerText: 'Eksempel: streamingpakke med Netflix og TV 2 Play. Pris og indhold ikke bekræftet.',
  },
  {
    id: 'yousee-bland-selv', providerId: 'yousee', name: 'Bland Selv streaming', category: 'bundle', price: 349,
    includes: [{ serviceId: 'netflix', capacity: 2 }, { serviceId: 'hbomax', capacity: 2 }, { serviceId: 'tv2play', capacity: 2 }],
    offerText: 'Eksempel: vælg tjenester via point. Pris og indhold ikke bekræftet.',
  },
]
