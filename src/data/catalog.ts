import type { Bundle, Service } from '../lib/types'

/**
 * Danish market, monthly prices in DKK. Prices change often, so they are
 * approximate starting points and every price can be edited in the app.
 */
export const PRICES_AS_OF = 'late 2025'

export const SERVICES: Service[] = [
  {
    id: 'netflix',
    name: 'Netflix',
    category: 'video',
    color: '#e50914',
    capacityType: 'streams',
    url: 'https://www.netflix.com/dk-en/',
    sharing: {
      householdOnly: true,
      enforcement: 'strict',
      howEnforced:
        'Netflix works out your household from the TV and devices on your home Wi‑Fi. Devices that are regularly used elsewhere get blocked or asked for a verification code, and "travel" access is temporary. The rules have been enforced in Denmark since 2023.',
      officialSharing:
        'Buy an "Extra member" slot for someone outside your home: they get their own login and 1 stream. Standard gives 1 slot, Premium gives 2. The ad tier has none.',
    },
    plans: [
      { id: 'netflix-ads', serviceId: 'netflix', name: 'Standard with ads', price: 69, capacity: 2, ads: true },
      { id: 'netflix-standard', serviceId: 'netflix', name: 'Standard', price: 129, capacity: 2, ads: false, extraMember: { price: 49, slots: 1 } },
      { id: 'netflix-premium', serviceId: 'netflix', name: 'Premium', price: 179, capacity: 4, ads: false, extraMember: { price: 49, slots: 2 } },
    ],
  },
  {
    id: 'disney',
    name: 'Disney+',
    category: 'video',
    color: '#113ccf',
    capacityType: 'streams',
    url: 'https://www.disneyplus.com/da-dk',
    sharing: {
      householdOnly: true,
      enforcement: 'high',
      howEnforced:
        'Disney+ rolled out "paid sharing" through 2024–25. It checks where an account is used and asks people outside the household to pay for an extra member or get their own subscription.',
      officialSharing:
        'Add a paid extra member where that is offered. Otherwise each household needs its own subscription. Paying yearly gives about 2 months free.',
    },
    plans: [
      { id: 'disney-ads', serviceId: 'disney', name: 'Standard with ads', price: 69, capacity: 2, ads: true },
      { id: 'disney-standard', serviceId: 'disney', name: 'Standard', price: 99, annualPrice: 990, capacity: 2, ads: false },
      { id: 'disney-premium', serviceId: 'disney', name: 'Premium', price: 139, annualPrice: 1390, capacity: 4, ads: false },
    ],
  },
  {
    id: 'hbomax',
    name: 'HBO Max',
    category: 'video',
    color: '#5822b4',
    capacityType: 'streams',
    url: 'https://www.hbomax.com/dk/da',
    sharing: {
      householdOnly: true,
      enforcement: 'medium',
      howEnforced:
        'HBO Max began cracking down on password sharing in 2025. It warns account owners about use outside the home and is moving toward an "extra member" add-on. The checks are stricter in some markets than in others.',
      officialSharing: 'One household per subscription. A paid extra-member add-on is rolling out market by market.',
    },
    plans: [
      { id: 'hbomax-basic', serviceId: 'hbomax', name: 'Basic with ads', price: 69, capacity: 2, ads: true },
      { id: 'hbomax-standard', serviceId: 'hbomax', name: 'Standard', price: 109, annualPrice: 1090, capacity: 2, ads: false },
      { id: 'hbomax-premium', serviceId: 'hbomax', name: 'Premium', price: 149, annualPrice: 1490, capacity: 4, ads: false },
    ],
  },
  {
    id: 'viaplay',
    name: 'Viaplay',
    category: 'sport',
    color: '#ff2e5f',
    capacityType: 'streams',
    url: 'https://viaplay.dk',
    sharing: {
      householdOnly: true,
      enforcement: 'medium',
      howEnforced:
        'The terms limit an account to one household. Viaplay caps registered devices and simultaneous streams, and it has tightened account-sharing checks on its sports packages.',
      officialSharing: 'None. Each household needs its own subscription.',
    },
    plans: [
      { id: 'viaplay-film', serviceId: 'viaplay', name: 'Film & Series', price: 149, capacity: 2, ads: false },
      { id: 'viaplay-total', serviceId: 'viaplay', name: 'Total (incl. sport)', price: 449, capacity: 2, ads: false },
    ],
  },
  {
    id: 'tv2play',
    name: 'TV 2 Play',
    category: 'video',
    color: '#0a64d6',
    capacityType: 'streams',
    url: 'https://play.tv2.dk',
    sharing: {
      householdOnly: true,
      enforcement: 'low',
      howEnforced:
        'The terms say household use only, but in practice the only limits are simultaneous streams and a Danish IP address.',
      officialSharing: 'None. One household per subscription.',
    },
    plans: [
      { id: 'tv2play-basis', serviceId: 'tv2play', name: 'Basis (ads)', price: 99, capacity: 2, ads: true },
      { id: 'tv2play-favorit', serviceId: 'tv2play', name: 'Favorit (ads)', price: 149, capacity: 2, ads: true },
      { id: 'tv2play-favorit-noads', serviceId: 'tv2play', name: 'Favorit without ads', price: 199, capacity: 2, ads: false },
      { id: 'tv2play-sport', serviceId: 'tv2play', name: 'Favorit + Sport (ads)', price: 249, capacity: 2, ads: true },
    ],
  },
  {
    id: 'skyshowtime',
    name: 'SkyShowtime',
    category: 'video',
    color: '#00a3e0',
    capacityType: 'streams',
    url: 'https://www.skyshowtime.com/dk',
    sharing: {
      householdOnly: true,
      enforcement: 'low',
      howEnforced: 'The terms say household use only. There are no known active household checks, just a stream limit.',
      officialSharing: 'None.',
    },
    plans: [
      { id: 'skyshowtime-ads', serviceId: 'skyshowtime', name: 'Standard with ads', price: 49, capacity: 2, ads: true },
      { id: 'skyshowtime-standard', serviceId: 'skyshowtime', name: 'Standard', price: 69, annualPrice: 690, capacity: 2, ads: false },
      { id: 'skyshowtime-premium', serviceId: 'skyshowtime', name: 'Premium', price: 99, capacity: 3, ads: false },
    ],
  },
  {
    id: 'prime',
    name: 'Prime Video',
    category: 'video',
    color: '#1399ff',
    capacityType: 'streams',
    url: 'https://www.primevideo.com',
    sharing: {
      householdOnly: true,
      enforcement: 'low',
      howEnforced:
        'Up to 3 simultaneous streams. Amazon does not actively check where an account is used. The "Amazon Household" sharing feature is not offered in Denmark.',
      officialSharing: 'Profiles within one household.',
    },
    plans: [
      { id: 'prime-ads', serviceId: 'prime', name: 'Prime Video (ads)', price: 59, capacity: 3, ads: true },
      { id: 'prime-noads', serviceId: 'prime', name: 'Prime Video ad-free', price: 79, capacity: 3, ads: false },
    ],
  },
  {
    id: 'nordiskfilm',
    name: 'Nordisk Film+',
    category: 'video',
    color: '#c8a24a',
    capacityType: 'streams',
    url: 'https://www.nordiskfilmplus.com',
    sharing: {
      householdOnly: true,
      enforcement: 'low',
      howEnforced: 'Limited by simultaneous streams only.',
      officialSharing: 'None.',
    },
    plans: [{ id: 'nordiskfilm-std', serviceId: 'nordiskfilm', name: 'Standard', price: 69, capacity: 2, ads: false }],
  },
  {
    id: 'appletv',
    name: 'Apple TV',
    category: 'video',
    color: '#8e8e93',
    capacityType: 'seats',
    url: 'https://tv.apple.com/dk',
    sharing: {
      householdOnly: false,
      enforcement: 'none',
      howEnforced:
        'There are no household checks. Family Sharing is officially supported and does not require family members to live at the same address.',
      officialSharing: 'Family Sharing covers up to 6 people with their own Apple Accounts.',
    },
    plans: [{ id: 'appletv-std', serviceId: 'appletv', name: 'Apple TV (formerly TV+)', price: 99, capacity: 6, ads: false }],
  },
  {
    id: 'drtv',
    name: 'DR TV',
    category: 'free',
    color: '#d71920',
    capacityType: 'seats',
    url: 'https://www.dr.dk/drtv',
    sharing: {
      householdOnly: false,
      enforcement: 'none',
      howEnforced: 'It is free (paid through taxes), so everyone can create their own login.',
      officialSharing: 'Free for everyone.',
    },
    plans: [{ id: 'drtv-free', serviceId: 'drtv', name: 'Free', price: 0, capacity: 99, ads: false, note: 'Free: everyone creates their own login' }],
  },
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'music',
    color: '#1db954',
    capacityType: 'seats',
    url: 'https://www.spotify.com/dk-en/premium/',
    sharing: {
      householdOnly: true,
      enforcement: 'medium',
      howEnforced:
        'Duo and Family members must live at the same address. Spotify asks for the address when someone joins and can re-verify it later. Accounts that fail the check get dropped from the plan.',
      officialSharing: 'Duo covers 2 people and Family covers up to 6, all at the same address. Students get a discount.',
    },
    plans: [
      { id: 'spotify-individual', serviceId: 'spotify', name: 'Individual', price: 119, capacity: 1, ads: false },
      { id: 'spotify-duo', serviceId: 'spotify', name: 'Duo', price: 159, capacity: 2, ads: false },
      { id: 'spotify-family', serviceId: 'spotify', name: 'Family', price: 189, capacity: 6, ads: false },
    ],
  },
  {
    id: 'youtube',
    name: 'YouTube Premium',
    category: 'music',
    color: '#ff0000',
    capacityType: 'seats',
    url: 'https://www.youtube.com/premium',
    sharing: {
      householdOnly: true,
      enforcement: 'high',
      howEnforced:
        "Family members must live in the manager's household. Google checks member locations about every 30 days and pauses members who live elsewhere. It has been stricter since 2025.",
      officialSharing: 'The Family plan covers the manager plus 5 members in the same household.',
    },
    plans: [
      { id: 'youtube-individual', serviceId: 'youtube', name: 'Individual', price: 99, capacity: 1, ads: false },
      { id: 'youtube-family', serviceId: 'youtube', name: 'Family', price: 199, capacity: 6, ads: false },
    ],
  },
  {
    id: 'applemusic',
    name: 'Apple Music',
    category: 'music',
    color: '#fa2d48',
    capacityType: 'seats',
    url: 'https://www.apple.com/dk/apple-music/',
    sharing: {
      householdOnly: false,
      enforcement: 'none',
      howEnforced: 'There are no address checks. Family Sharing is officially supported for up to 6 people.',
      officialSharing: 'The Family plan covers up to 6 people with their own Apple Accounts.',
    },
    plans: [
      { id: 'applemusic-individual', serviceId: 'applemusic', name: 'Individual', price: 109, capacity: 1, ads: false },
      { id: 'applemusic-family', serviceId: 'applemusic', name: 'Family', price: 169, capacity: 6, ads: false },
    ],
  },
]

export const PRESET_BUNDLES: Bundle[] = [
  {
    id: 'appleone-individual',
    name: 'Apple One Individual',
    provider: 'Apple',
    price: 129,
    ads: false,
    includes: [
      { serviceId: 'appletv', capacity: 1 },
      { serviceId: 'applemusic', capacity: 1 },
    ],
    note: 'Also includes Apple Arcade and 50 GB of iCloud+.',
  },
  {
    id: 'appleone-family',
    name: 'Apple One Family',
    provider: 'Apple',
    price: 179,
    ads: false,
    includes: [
      { serviceId: 'appletv', capacity: 6 },
      { serviceId: 'applemusic', capacity: 6 },
    ],
    note: 'Also includes Arcade and 200 GB of iCloud+. Family Sharing covers up to 6 people in any home.',
  },
]

/** General money-saving tips that are hard to price automatically. */
export const DEAL_TIPS: { title: string; body: string }[] = [
  {
    title: 'Telco and broadband bundles',
    body: 'YouSee, Telmore Play, Norlys and Telia sell mix-and-match streaming packages, often cheaper than paying for each service separately. Add yours under "Your deals" so the optimiser counts it.',
  },
  {
    title: 'Mobile plans with streaming included',
    body: 'Some mobile subscriptions include HBO Max, Netflix, Viaplay or Spotify. If someone in the family already pays for one, add it as a deal with price 0.',
  },
  {
    title: 'Pay yearly',
    body: 'Disney+, HBO Max and SkyShowtime give roughly 2 months free when you pay for a year. Turn on "Annual billing" to include it.',
  },
  {
    title: 'Rotate instead of stacking',
    body: 'You rarely need every service at once. Subscribe to one or two, watch what you want, cancel, then switch. Most services have no binding period.',
  },
  {
    title: 'Student discounts',
    body: 'Spotify and Apple Music offer about 50% off for students, which can beat joining a family plan.',
  },
]
