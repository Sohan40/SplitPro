const {
  buildCompactExpenseSummary,
  buildNotificationBody,
  collectInvolvedMemberIds,
  detectMeaningfulExpenseChanges,
  hashChangedFields,
  makeExpenseUpdateIds,
  normalizeParticipants,
} = require("../functions/src/expenses/expenseUpdateActivity");

const baseExpense = {
  id: "expense-1",
  groupId: "group-1",
  description: "Lunch",
  amount: 120,
  category: "food",
  splitType: "equal",
  paidBy: { uid: "alice", name: "Alice" },
  participants: [
    { uid: "alice", name: "Alice", amount: 60 },
    { uid: "bob", name: "Bob", amount: 60 },
  ],
  createdBy: "alice",
  createdAt: 1710000000000,
  updatedBy: "alice",
  updatedAt: 1710000000000,
};

describe("expense update activity helpers", () => {
  it("detects meaningful expense field changes", () => {
    const changed = detectMeaningfulExpenseChanges(baseExpense, {
      ...baseExpense,
      amount: 150,
      category: "shopping",
      paidBy: { uid: "bob", name: "Bob" },
      splitType: "custom",
      participants: [
        { uid: "alice", name: "Alice", amount: 30 },
        { uid: "bob", name: "Bob", amount: 120 },
      ],
    });

    expect(changed.map(field => field.key)).toEqual([
      "amount",
      "category",
      "paidBy",
      "splitType",
      "participants",
    ]);
  });

  it("skips metadata-only changes", () => {
    const changed = detectMeaningfulExpenseChanges(baseExpense, {
      ...baseExpense,
      updatedBy: "bob",
      updatedAt: 1710000005000,
    });

    expect(changed).toEqual([]);
  });

  it("normalizes participant splits by uid and cents", () => {
    expect(normalizeParticipants([
      { uid: "bob", name: "Bobby", amount: 60.004 },
      { uid: "alice", name: "Alicia", amount: 59.996 },
    ])).toEqual([
      { uid: "alice", amountCents: 6000 },
      { uid: "bob", amountCents: 6000 },
    ]);
  });

  it("creates stable changed field hashes and deterministic ids", () => {
    const fields = [
      { key: "participants", label: "Split" },
      { key: "amount", label: "Amount" },
    ];

    expect(hashChangedFields(fields)).toBe(hashChangedFields([...fields].reverse()));
    const firstIds = makeExpenseUpdateIds("expense-1", 1710000005000, fields);
    const secondIds = makeExpenseUpdateIds("expense-1", 1710000005000, [...fields].reverse());

    expect(firstIds.activityId).toBe(secondIds.activityId);
    expect(firstIds.fieldHash).toBe(secondIds.fieldHash);
    expect(firstIds.notificationIdForUser("bob")).toBe(secondIds.notificationIdForUser("bob"));
  });

  it("collects previous and new involved users while excluding actor", () => {
    const recipients = collectInvolvedMemberIds(
      baseExpense,
      {
        ...baseExpense,
        paidBy: { uid: "charlie", name: "Charlie" },
        participants: [
          { uid: "bob", name: "Bob", amount: 50 },
          { uid: "charlie", name: "Charlie", amount: 70 },
          { uid: "outsider", name: "Outsider", amount: 30 },
        ],
      },
      ["alice", "bob", "charlie"],
      "alice",
    );

    expect(recipients).toEqual(["bob", "charlie"]);
  });

  it("stores compact summaries without full expense payloads", () => {
    const summary = buildCompactExpenseSummary(baseExpense);

    expect(summary).toEqual({
      amount: 120,
      category: "food",
      paidByName: "Alice",
      splitType: "equal",
      participantCount: 2,
    });
    expect(summary).not.toHaveProperty("description");
    expect(summary).not.toHaveProperty("participants");
    expect(summary).not.toHaveProperty("paidBy");
  });

  it("uses concise notification copy", () => {
    expect(buildNotificationBody("Alex", "Lunch", "Bali Trip", [
      { key: "amount", label: "Amount" },
    ])).toBe("Alex changed the amount for Lunch.");

    expect(buildNotificationBody("Alex", "Dinner", "Bali Trip", [
      { key: "category", label: "Category" },
      { key: "participants", label: "Split" },
    ])).toBe("Alex updated Dinner in Bali Trip.");
  });
});
