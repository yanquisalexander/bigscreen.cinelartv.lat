import { VastRotation } from '@/services/player/vast-rotation';

const PREROLL_TAGS = [
  {
    url: 'https://pubads.g.doubleclick.net/gampad/live/ads?iu=/22530741549/CTV_VAST_ADS&description_url=[DESCRIPTION_URL]&tfcd=0&npa=0&sz=400x300%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&impl=s&correlator=[CACHEBUSTER]',
    label: 'google-ad-manager',
  },
  {
    url: 'https://s.magsrv.com/v1/vast.php?idz=5963002',
    label: 'exoclick',
  },
];

const POSTROLL_TAGS = [
  {
    url: 'https://s.magsrv.com/v1/vast.php?idz=5963002',
    label: 'exoclick',
  },
  {
    url: 'https://pubads.g.doubleclick.net/gampad/live/ads?iu=/22530741549/CTV_VAST_ADS&description_url=[DESCRIPTION_URL]&tfcd=0&npa=0&sz=400x300%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&impl=s&correlator=[CACHEBUSTER]',
    label: 'google-ad-manager',
  },
];

export const prerollAds = new VastRotation(PREROLL_TAGS);
export const postrollAds = new VastRotation(POSTROLL_TAGS);
