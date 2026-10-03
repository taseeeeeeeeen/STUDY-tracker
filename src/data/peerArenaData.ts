import { PeerContender, ActiveSprintChallenge } from '../types/peerArena';

const NOW = Date.now();
const ONE_HOUR = 60 * 60 * 1000;

// REQUIREMENT 1: Challenge Code Generator
// Generates a random 6-character alphanumeric code (e.g., CH-9A2X)
export function generateChallengeCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomStr = '';
  for (let i = 0; i < 4; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CH-${randomStr}`;
}

export const INITIAL_CHALLENGE: ActiveSprintChallenge = {
  title: '30-Day HSC Board Exam Sprint: Higher Math & Physics Core',
  cohortName: 'Verified HSC Cohort Dhaka',
  code: 'CH-9A2X',
  totalTopics: 30,
  activePeersCount: 18,
  timeRemainingStr: '4d 18h 32m',
};

// REQUIREMENT 2: Dummy array of objects representing friends in the same challenge
// Each object has: name, completed_topics, total_challenge_topics, last_completion_timestamp
export const INITIAL_PEERS: PeerContender[] = [
  {
    id: 'peer-1',
    name: 'Rahim Chowdhury',
    cohort: "Batch '25 • Notre Dame College",
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAvUDWHNimncsB6rCg-AH7R5SqcfJ7-8kw7Jc6RQ6Mr4870c3GtCGRaW87iAMOfVI6uofzqWIuV0ye_4Jfdqdl4fdpm02RUh2LsIlfCg2z62K1_A6_mxN6lULBP7ADmwGRkgAhSGyy9UVPk1yaAiG5yK4CA5zGcOVc6G1-l9dFY7hh0OuvcBjAs4acBIkxXHgPJPb5ahEnEt7cgZ-t8oyq3Pknk_uss-r7QakGcYloijl3-zjgCmXzqng',
    activeFocus: 'Integrals Calc II',
    completed_topics: 28,
    total_challenge_topics: 30,
    last_completion_timestamp: NOW - 2 * ONE_HOUR,
    velocityPerDay: 2.4,
    streakDays: 19,
    isSquad: true,
    rankTrend: 0,
  },
  {
    id: 'peer-2',
    name: 'Tanvir Hasan',
    cohort: "Batch '25 • Dhaka College",
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuASGJ9NnhlAai3W7yf7dD14vnRF2eoNyAs3UzZ6lzrg9fefvqPWrddxPLtI4WceY4myDCOaGnAm5M76D-JAUCWeJDWwR9e1IBjBUdDGeNi-IBmjxIICtflNIAf8NjAMP59Tljl0XYrpOUcFkDC1m_Mh4fiToJNQz8V1BBjEpsOd8e4hKxV-_NbzLfqhoLDvGdSVFNCRWQ4AnZiX3o3WIBYXtmT9LyW4yJSOi4Jh-hBfWY7OYDtjmJn8kw',
    activeFocus: 'Magnetic Effects',
    completed_topics: 26,
    total_challenge_topics: 30,
    last_completion_timestamp: NOW - 5 * ONE_HOUR,
    velocityPerDay: 1.8,
    streakDays: 15,
    isSquad: false,
    rankTrend: 1,
  },
  {
    id: 'peer-3',
    name: 'Nusrat Jahan',
    cohort: "Batch '25 • Viqarunnisa Noon",
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBWHMI9he4Lp8bTuO2PyHQBv_17-n5HDtxOYkHwSS_wtDxqWkOl14rKtS8prBUUlE-nI9HIwkd746j05lnJdgIqoRWtlaPWf4JsjZwsrkJMfz7komRws8fIeSmEpQfgFwl7J45yluJu2sV8HX2q2Nr_zGg-07IKviJoZkTP5IHAkBXm4kO8WXuK2X3qW9ntdo8cT-5kF_7yHYwCTIVraZ9R-gmSAspSPM9slwxy2BLn5KIKtRlE9UizJg',
    activeFocus: 'Organic Benzene',
    completed_topics: 24,
    total_challenge_topics: 30,
    last_completion_timestamp: NOW - 7 * ONE_HOUR,
    velocityPerDay: 1.5,
    streakDays: 11,
    isSquad: true,
    rankTrend: -1,
  },
  {
    id: 'peer-user',
    name: 'Elena Vance',
    cohort: "Batch '25 • Residential Model",
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB0POR0Sd281m1Oo5_8GQf-RXI6k6o9qikteIgJ3h3W83sSkYBytcZaC2yi_665T6jFg4RYO1iWxPbIWbHTHbSAx8duI8CHnR1POPtAJR6sHC61o4SOAqjSdgrgLKNkLSPiltYIeKHENw013mMKGkYADrxw5R5BPVcmY2pfk9I1L2wTzZbo5-Al_KInBTLj5gOEYN_60YKyRN26vHSW5Eaw8-g_xRRbpFI7KrNFZj-0lZIUC-YVthIbAg',
    activeFocus: 'Semiconductor & Diodes',
    completed_topics: 23,
    total_challenge_topics: 30,
    last_completion_timestamp: NOW - 4 * ONE_HOUR,
    velocityPerDay: 1.9,
    streakDays: 12,
    isCurrentUser: true,
    isSquad: true,
    rankTrend: 2,
  },
  {
    id: 'peer-4',
    name: 'Fahim Al-Muqtadir',
    cohort: "Batch '25 • St. Joseph H.S.",
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCd4_oBpPQctK6skZLvPNSwOxDRxFAJCrzBjnJBU8W74dThQK559FntLXiNnVRSvNbz7G69A0OH3pPPfM8hiBKGD24hcMoiGt0-OV2dvja8jBj0RsR7jae9pycWc_pHrhskWYTVKRp0vAJE9KNRis2VWMnM7Sll7vl-fqZtPbWHWtThUXi9IYFo8fDF_U8WiyeQ2YIkmgQkvUhDLPd0xnPE5e8h3A01WgkKpfdA-mqhOJWkpA11QBtTsQ',
    activeFocus: 'Wave Optics',
    completed_topics: 21,
    total_challenge_topics: 30,
    last_completion_timestamp: NOW - 12 * ONE_HOUR,
    velocityPerDay: 1.3,
    streakDays: 8,
    isSquad: false,
    rankTrend: 0,
  },
  {
    id: 'peer-5',
    name: 'Anika Tabassum',
    cohort: "Batch '25 • Holy Cross College",
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD_OWfLXE5EGFiZwJZZwRoMg7-U0zEaxqJrwro-hsi-ecD-mhiWxxiTDBmt1D9l3SzAagqFuTbi3Xnb6krnvF2UGTzFnsCK6iYApQVrKt2BteNDNtDzPpP84rEGl1YJPS4lQbr0JKtcowOKvGJoaORfzA__zmg1GB72rnmrLnmn9yCf-TjLgFEPMt9YGvmhQdALHogxyGIe-z0m_P-nJHJFmORDSjsZcQtEWtNNrsT15X8fnes3iyss8w',
    activeFocus: 'Thermodynamics',
    completed_topics: 20,
    total_challenge_topics: 30,
    last_completion_timestamp: NOW - 14 * ONE_HOUR,
    velocityPerDay: 1.2,
    streakDays: 9,
    isSquad: true,
    rankTrend: -2,
  },
  {
    id: 'peer-6',
    name: 'Zubair Ahmed',
    cohort: "Batch '25 • Rajuk Uttara Model",
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDbBlUAsZuR3_Q8VEBSXrGw0gJfgViJnmH50RJK6XpM5Ar90LZMt7rkqCn8l5l_ysKa3H56YW4-dhQSljd_ZNTshkCnYKH0P1ZZGjrQrxSd--ujgNcYTRVSe68xm16AKNRBJ3gI1sYIJHRSVIEqe9hdVknAnxbYqbgftyZvhCaaTOI4YNgOzY99PB3US0_AUx0BcISRlE5FnZ_0B-vf-Uii-VfsGOD18WmcySsUQ5O44BSiuqOzNyAptQ',
    activeFocus: 'Chemical Equilibrium',
    completed_topics: 19,
    total_challenge_topics: 30,
    last_completion_timestamp: NOW - 16 * ONE_HOUR,
    velocityPerDay: 1.1,
    streakDays: 6,
    isSquad: false,
    rankTrend: 1,
  },
  {
    id: 'peer-7',
    name: 'Mehnaz Parveen',
    cohort: "Batch '25 • Adamjee Cantonment",
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCX4Ubc8IjjVBgnvfnoPOsD2_2SLwwA5mb_utsS1HuNiHxS6t-zkYLd86peHTvlvK0xKdmYNL8FPAKXbsSwGYi81YyQG2DLV45dlmo69FkZCsO4nDDxO1WQZZ2dFWKGdnrpI_OA8YfRsx8X5amY4Nqag1TIYuwUhnZ5yUPCYUYJazBFxfwgtRFDLtGW1e3m3lDrjyZ5xj4USBngk3_sfgQjgkVnvyhwYuIlWhYBGkrWqh--BGv-oKKigQ',
    activeFocus: 'Conics & Parabola',
    completed_topics: 18,
    total_challenge_topics: 30,
    last_completion_timestamp: NOW - 18 * ONE_HOUR, // Finished earlier than Samin -> ranks higher!
    velocityPerDay: 1.0,
    streakDays: 7,
    isSquad: false,
    rankTrend: 0,
  },
  {
    id: 'peer-8',
    name: 'Samin Yeasar',
    cohort: "Batch '25 • Chittagong College",
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAvUDWHNimncsB6rCg-AH7R5SqcfJ7-8kw7Jc6RQ6Mr4870c3GtCGRaW87iAMOfVI6uofzqWIuV0ye_4Jfdqdl4fdpm02RUh2LsIlfCg2z62K1_A6_mxN6lULBP7ADmwGRkgAhSGyy9UVPk1yaAiG5yK4CA5zGcOVc6G1-l9dFY7hh0OuvcBjAs4acBIkxXHgPJPb5ahEnEt7cgZ-t8oyq3Pknk_uss-r7QakGcYloijl3-zjgCmXzqng',
    activeFocus: 'Circular Motion',
    completed_topics: 18,
    total_challenge_topics: 30,
    last_completion_timestamp: NOW - 17 * ONE_HOUR, // Finished later than Mehnaz -> tie breaker puts Samin lower!
    velocityPerDay: 0.9,
    streakDays: 5,
    isSquad: true,
    rankTrend: -1,
  },
];
