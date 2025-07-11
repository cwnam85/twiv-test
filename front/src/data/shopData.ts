import { ShopData } from '../types';

export const SHOP_DATA: ShopData = {
  backgrounds: [
    {
      id: 'default',
      name: '기본 배경',
      type: 'background',
      price: 0,
      description: '기본 배경으로 돌아갑니다.',
      isOwned: true, // 기본 배경은 항상 소유
    },
    {
      id: 'school',
      name: '학교',
      type: 'background',
      price: 50,
      description: '학교 배경으로 교실에서 대화를 나눠보세요.',
      isOwned: false,
    },
    {
      id: 'beach',
      name: '해변',
      type: 'background',
      price: 80,
      description: '아름다운 해변에서 휴식을 취해보세요.',
      isOwned: false,
    },
  ],
  outfits: [
    {
      id: 'default',
      name: '기본 의상',
      type: 'outfit',
      price: 0,
      description: '기본 의상으로 돌아갑니다.',
      isOwned: true, // 기본 의상은 항상 소유
    },
    {
      id: 'school_uniform',
      name: '교복',
      type: 'outfit',
      price: 100,
      description: '깔끔한 학교 교복을 입어보세요.',
      isOwned: false,
    },
    {
      id: 'swimsuit',
      name: '수영복',
      type: 'outfit',
      price: 150,
      description: '활기찬 수영복으로 즐거운 시간을 보내세요.',
      isOwned: false,
    },
  ],
  boosters: [
    {
      id: 'affinity_booster',
      name: '호감도 부스터',
      type: 'booster',
      price: 200,
      description: '호감도를 100으로 설정하고 10분간 유지합니다.',
      isOwned: false,
    },
  ],
};
