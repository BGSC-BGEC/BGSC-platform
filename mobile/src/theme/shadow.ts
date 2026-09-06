import { Platform, type ViewStyle } from 'react-native';

export const NEU_SHADOWS = {
  raised: {
    shadowColor: '#375534',
    shadowOffset: {
      width: 7,
      height: 7,
    },
    shadowOpacity: 0.24,
    shadowRadius: 10,

    elevation: 7,
  } satisfies ViewStyle,

  raisedSmall: {
    shadowColor: '#375534',
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.20,
    shadowRadius: 7,

    elevation: 4,
  } satisfies ViewStyle,

  floating: {
    shadowColor: '#375534',
    shadowOffset: {
      width: 10,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 15,

    elevation: 10,
  } satisfies ViewStyle,

  pressed: {
    shadowColor: '#375534',
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.14,
    shadowRadius: 4,

    elevation: 2,
  } satisfies ViewStyle,
} as const;