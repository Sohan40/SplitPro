import {
  calculateSharesSplit,
  inferSharesFromSplitAmounts,
} from '../src/utils/splitCalculator';

describe('splitCalculator', () => {
  it('infers equal shares from rounded participant amounts', () => {
    const participants = calculateSharesSplit(10, [
      { uid: 'a', name: 'Alex', shares: 1 },
      { uid: 'm', name: 'Mia', shares: 1 },
      { uid: 'n', name: 'Noah', shares: 1 },
    ]);

    expect(inferSharesFromSplitAmounts(10, participants)).toEqual({
      a: 1,
      m: 1,
      n: 1,
    });
  });

  it('infers uneven whole-number shares from saved split amounts', () => {
    const participants = calculateSharesSplit(100, [
      { uid: 'a', name: 'Alex', shares: 3 },
      { uid: 'm', name: 'Mia', shares: 2 },
      { uid: 'n', name: 'Noah', shares: 1 },
    ]);

    expect(inferSharesFromSplitAmounts(100, participants)).toEqual({
      a: 3,
      m: 2,
      n: 1,
    });
  });

  it('keeps non-participants at zero shares', () => {
    const participants = [
      ...calculateSharesSplit(100, [
        { uid: 'a', name: 'Alex', shares: 2 },
        { uid: 'm', name: 'Mia', shares: 1 },
      ]),
      { uid: 'n', name: 'Noah', amount: 0 },
    ];

    expect(inferSharesFromSplitAmounts(100, participants)).toEqual({
      a: 2,
      m: 1,
      n: 0,
    });
  });

  it('preserves selected zero-share participants when all saved amounts are zero', () => {
    expect(inferSharesFromSplitAmounts(100, [
      { uid: 'a', name: 'Alex', amount: 0 },
      { uid: 'm', name: 'Mia', amount: 0 },
      { uid: 'n', name: 'Noah', amount: 0 },
    ])).toEqual({
      a: 0,
      m: 0,
      n: 0,
    });
  });
});
