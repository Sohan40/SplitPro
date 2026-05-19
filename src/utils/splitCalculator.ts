import type { ExpenseParticipant } from '../models/Expense';

/**
 * Split an amount equally among a list of participants.
 * Handles penny rounding by giving the remainder to the first participant.
 */
export function calculateEqualSplit(amount: number, members: { uid: string; name: string }[]): ExpenseParticipant[] {
  if (members.length === 0 || amount <= 0) return [];

  const splitAmount = Math.floor((amount / members.length) * 100) / 100;
  let totalDistributed = splitAmount * members.length;
  let remainder = Math.round((amount - totalDistributed) * 100) / 100;

  return members.map((member, index) => {
    let finalAmount = splitAmount;
    if (index === 0 && remainder > 0) {
      finalAmount += remainder;
    }
    // Fix JS floating point issues
    finalAmount = Math.round(finalAmount * 100) / 100;
    
    return {
      uid: member.uid,
      name: member.name,
      amount: finalAmount,
    };
  });
}

/**
 * Split an amount based on exact custom amounts.
 * Returns the array if valid, throws if sums don't match.
 */
export function calculateCustomSplit(amount: number, participants: ExpenseParticipant[]): ExpenseParticipant[] {
  const sum = participants.reduce((acc, p) => acc + p.amount, 0);
  
  // Allowing a 1 cent buffer for floating point comparisons
  if (Math.abs(sum - amount) > 0.01) {
    throw new Error(`Total split amounts (${sum}) must equal the expense amount (${amount})`);
  }
  
  return participants;
}

/**
 * Split an amount based on percentages.
 * Handles penny rounding by giving the remainder to the first participant with a non-zero split.
 */
export function calculatePercentageSplit(
  amount: number, 
  members: { uid: string; name: string; percent: number }[]
): ExpenseParticipant[] {
  const totalPercent = members.reduce((acc, m) => acc + m.percent, 0);
  
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new Error(`Total percentage (${totalPercent}%) must equal 100%`);
  }

  let totalDistributed = 0;
  const participants = members.map(member => {
    const splitAmount = Math.floor((amount * (member.percent / 100)) * 100) / 100;
    totalDistributed += splitAmount;
    return {
      uid: member.uid,
      name: member.name,
      amount: splitAmount,
    };
  });

  const remainder = Math.round((amount - totalDistributed) * 100) / 100;
  if (remainder > 0) {
    // Add remainder to first person who actually owes something
    const firstPayer = participants.find(p => p.amount > 0) || participants[0];
    if (firstPayer) {
      firstPayer.amount = Math.round((firstPayer.amount + remainder) * 100) / 100;
    }
  }

  return participants;
}

/**
 * Split an amount based on relative shares (e.g., person A has 2 shares, person B has 1 share).
 */
export function calculateSharesSplit(
  amount: number,
  members: { uid: string; name: string; shares: number }[]
): ExpenseParticipant[] {
  const totalShares = members.reduce((acc, m) => acc + m.shares, 0);
  
  if (totalShares <= 0) {
    throw new Error('Total shares must be greater than 0');
  }

  let totalDistributed = 0;
  const participants = members.map(member => {
    const splitAmount = Math.floor((amount * (member.shares / totalShares)) * 100) / 100;
    totalDistributed += splitAmount;
    return {
      uid: member.uid,
      name: member.name,
      amount: splitAmount,
    };
  });

  const remainder = Math.round((amount - totalDistributed) * 100) / 100;
  if (remainder > 0) {
    const firstPayer = participants.find(p => p.amount > 0) || participants[0];
    if (firstPayer) {
      firstPayer.amount = Math.round((firstPayer.amount + remainder) * 100) / 100;
    }
  }

  return participants;
}

/**
 * Infer a compact whole-number share setup from already-resolved participant
 * amounts. This is used when editing older shares expenses, because persisted
 * expense participants store resolved amounts rather than the original share
 * counts.
 */
export function inferSharesFromSplitAmounts(
  amount: number,
  participants: ExpenseParticipant[],
  maxTotalShares = 100,
): Record<string, number> {
  const positiveParticipants = participants.filter(p => p.amount > 0);
  if (amount <= 0 || positiveParticipants.length === 0) {
    return participants.reduce<Record<string, number>>((result, participant) => {
      result[participant.uid] = 0;
      return result;
    }, {});
  }

  const minTotalShares = positiveParticipants.length;
  let bestShares: number[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestTotalShares = Number.POSITIVE_INFINITY;

  for (let totalShares = minTotalShares; totalShares <= maxTotalShares; totalShares += 1) {
    const targets = positiveParticipants.map(p => (p.amount / amount) * totalShares);
    const shares = targets.map(target => Math.max(1, Math.round(target)));
    let shareSum = shares.reduce((sum, value) => sum + value, 0);

    while (shareSum > totalShares) {
      let bestIndex = -1;
      let smallestPenalty = Number.POSITIVE_INFINITY;

      shares.forEach((share, index) => {
        if (share <= 1) return;
        const penalty =
          Math.abs((share - 1) - targets[index]) - Math.abs(share - targets[index]);
        if (penalty < smallestPenalty) {
          smallestPenalty = penalty;
          bestIndex = index;
        }
      });

      if (bestIndex === -1) break;
      shares[bestIndex] -= 1;
      shareSum -= 1;
    }

    while (shareSum < totalShares) {
      let bestIndex = 0;
      let smallestPenalty = Number.POSITIVE_INFINITY;

      shares.forEach((share, index) => {
        const penalty =
          Math.abs((share + 1) - targets[index]) - Math.abs(share - targets[index]);
        if (penalty < smallestPenalty) {
          smallestPenalty = penalty;
          bestIndex = index;
        }
      });

      shares[bestIndex] += 1;
      shareSum += 1;
    }

    const reconstructed = calculateSharesSplit(
      amount,
      positiveParticipants.map((participant, index) => ({
        uid: participant.uid,
        name: participant.name,
        shares: shares[index],
      })),
    );
    const score = reconstructed.reduce((sum, participant) => {
      const original = positiveParticipants.find(p => p.uid === participant.uid);
      return sum + Math.abs(participant.amount - (original?.amount || 0));
    }, 0);

    if (
      score < bestScore - 0.001 ||
      (Math.abs(score - bestScore) <= 0.001 && totalShares < bestTotalShares)
    ) {
      bestScore = score;
      bestShares = shares;
      bestTotalShares = totalShares;
    }

    if (score <= 0.001) break;
  }

  return participants.reduce<Record<string, number>>((result, participant) => {
    const positiveIndex = positiveParticipants.findIndex(p => p.uid === participant.uid);
    result[participant.uid] = positiveIndex >= 0 ? bestShares?.[positiveIndex] ?? 1 : 0;
    return result;
  }, {});
}
