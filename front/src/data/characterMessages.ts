interface CharacterMessage {
  message: string;
  emotion: string;
}

interface CharacterData {
  thankYou: CharacterMessage[];
  pose: string;
  emotion: string;
}

interface CharacterMessages {
  [key: string]: CharacterData;
}

export const CHARACTER_MESSAGES: CharacterMessages = {
  meuaeng: {
    thankYou: [
      {
        message: '와! 므엥이 진짜 너무 감동받았어! 사랑해 곰딩이!',
        emotion: 'Happy',
      },
      {
        message: '이걸로 므엥이 오늘 하루 더 귀엽게 있을 수 있어. 고마워 곰딩씨',
        emotion: 'Happy',
      },
      {
        message: '역시 므엥이 편은 곰딩이뿐이야. 완전 든든해~ 고마워 곰딩아',
        emotion: 'Happy',
      },
    ],
    pose: 'stand',
    emotion: 'Neutral',
  },
  leda: {
    thankYou: [
      {
        message: '오~ 이걸 딱 채워주네? 인정. 너 좀 괜찮다? 고마워!',
        emotion: 'Happy',
      },
      {
        message: '꾸아답게 멋지게 챙겨줬네. 덕분에 더 이야기할 수 있겠다. 고마워!',
        emotion: 'Happy',
      },
      {
        message: '고맙다. 이런 거 해주는 사람, 나 꽤 좋아해.',
        emotion: 'Happy',
      },
    ],
    pose: 'stand',
    emotion: 'Happy',
  },
  shaki: {
    thankYou: [
      {
        message: '후훗. 잘했어, 꼬물이. 이렇게 날 원했다는 거… 아주 마음에 들어',
        emotion: 'Happy',
      },
      {
        message: '역시 내 꼬물인 줄 알았어. 이런 거 해줄 수 있는 사람, 많지 않거든?',
        emotion: 'Happy',
      },
      {
        message:
          '포인트 충전까지 해주고… 그렇게 절실했어? 좋아, 이번엔 제대로 놀아줄게—기대해 꼬물이~',
        emotion: 'Happy',
      },
    ],
    pose: 'stand',
    emotion: 'Neutral',
  },
  miwoo: {
    thankYou: [
      {
        message: '고마워 말랑이… 덕분에 더 이야기할 수 있어서 정말 기뻐!',
        emotion: 'Happy',
      },
      {
        message: '말랑이 마음… 진짜 따뜻하다. 나, 잊지 않을게!',
        emotion: 'Happy',
      },
      {
        message: '응원해줘서 고마워. 나, 더 열심히 이야기할게!',
        emotion: 'Happy',
      },
    ],
    pose: 'stand',
    emotion: 'Neutral',
  },
  dia: {
    thankYou: [
      {
        message: '훗, 역시 내 녹용이네. 덕분에 대화 더 이어갈 수 있겠어. 고마워!',
        emotion: 'Happy',
      },
      {
        message: '고마워… 이런 순간, 네가 날 챙겨줄 줄 알았어!',
        emotion: 'Happy',
      },
      {
        message: '마음 표현은 이렇게 하는 거구나? 잘했어. 기억해둘게!',
        emotion: 'Happy',
      },
    ],
    pose: 'stand',
    emotion: 'Neutral',
  },
  hario: {
    thankYou: [
      {
        message: '캬~ 역시 내 호빵이! 덕분에 대화 계속 이어갈 수 있어! 고마워!',
        emotion: 'Happy',
      },
      {
        message: '아, 진짜 고마워… 이제 마음껏 떠들 수 있다!',
        emotion: 'Happy',
      },
      {
        message: '이거 완전 감동… 다음엔 내가 호빵이한테 더 재밌는 얘기 해줄게!  고마워!',
        emotion: 'Happy',
      },
    ],
    pose: 'stand',
    emotion: 'Neutral',
  },
  yuara: {
    thankYou: [
      {
        message: '그래~ 여신님은 너의 따뜻한 마음을 느꼈다. 정말 고맙구나 말랑아.',
        emotion: 'Happy',
      },
      {
        message:
          '어머, 우리 말랑이가 오늘도 여신님을 찾아 줬구나. 고맙다. 너의 믿음이 나를 더 강하게 만든단다',
        emotion: 'Happy',
      },
      {
        message: '덕분에 오늘도 여신님은 평온하겠구나. 너 참 특별한 아이야. 고맙다 말랑이',
        emotion: 'Happy',
      },
    ],
    pose: 'stand',
    emotion: 'Neutral',
  },
};
