import { expenseService } from '../expenseService';
import { db } from '../firebase';

// Mock the firebase module
jest.mock('../firebase', () => {
  const mockDoc = {
    id: 'test-id',
    set: jest.fn(),
    get: jest.fn(() => ({
      exists: true,
      data: () => ({ id: 'test-id', amount: 100 }),
    })),
    delete: jest.fn(),
    onSnapshot: jest.fn(),
  };
  const mockCollection = {
    doc: jest.fn(() => mockDoc),
    where: jest.fn().mockReturnThis(),
    get: jest.fn(() => ({
      docs: [
        { data: () => ({ id: 'exp1', amount: 50, createdAt: 1 }) },
      ],
    })),
    onSnapshot: jest.fn(),
  };
  return {
    db: {
      collection: jest.fn(() => mockCollection),
    },
  };
});

describe('expenseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add an expense', async () => {
    const expenseData = {
      groupId: 'g1',
      description: 'Test',
      amount: 100,
      category: 'food' as any,
      paidBy: { uid: 'u1', name: 'User1' },
      splitType: 'equal' as any,
      participants: [],
      createdBy: 'u1',
      createdAt: 123,
    };

    const id = await expenseService.addExpense(expenseData);
    
    expect(db.collection).toHaveBeenCalledWith('expenses');
    expect(id).toBe('test-id');
  });

  it('should get group expenses', async () => {
    const expenses = await expenseService.getGroupExpenses('g1');
    expect(db.collection).toHaveBeenCalledWith('expenses');
    expect(expenses.length).toBe(1);
    expect(expenses[0].id).toBe('exp1');
  });

  it('should delete an expense', async () => {
    await expenseService.deleteExpense('test-id');
    expect(db.collection).toHaveBeenCalledWith('expenses');
  });
});
