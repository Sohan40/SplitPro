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
