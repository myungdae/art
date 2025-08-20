module.exports = {
  // 고용주(Job Vacancies): 광고 토큰 플랜
  employerAdPlans: [
    { ads: 1,  label: '1 Ad'  },
    { ads: 4,  label: '4 Ads' },
    { ads: 12, label: '12 Ads' },
    { ads: 24, label: '24 Ads' }
  ],

  // 구직자/온라인튜터: 노출 기간(일)
  profileDurations: [30, 90, 365],

  // 개별 구인공고의 기본 노출 기간(일) – 토큰과 별개로 공고 자체 만료일
  defaultJobAdLifetimeDays: 30
};
