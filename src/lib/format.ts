export const kr = (n: number) => `${Math.round(n).toLocaleString('da-DK')} kr.`
export const krShort = (n: number) => Math.round(n).toLocaleString('da-DK')

export const ENFORCEMENT_DA = {
  none: 'Deling tilladt',
  low: 'Næsten ikke håndhævet',
  medium: 'Håndhæves en gang imellem',
  high: 'Håndhæves aktivt',
  strict: 'Håndhæves strengt',
} as const

export const CATEGORY_DA = {
  streaming: 'Streaming',
  bundle: 'Pakke',
  mobile: 'Mobil',
  broadband: 'Internet',
  tv: 'TV',
} as const
