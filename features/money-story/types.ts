export type IncomeStability = 'stable' | 'variable' | 'business';
export type ProtectionType = 'health' | 'critical' | 'life' | 'motor' | 'home';
export type EventCategory = 'everyday' | 'work' | 'household' | 'health' | 'motor' | 'home' | 'family' | 'market' | 'crisis' | 'calm';
export type GameStatus = 'active' | 'win' | 'survive' | 'lose';
export type RecoveryActionId = 'extra-income' | 'expense-cut' | 'debt-restructure' | 'loan';

export type ProtectionHolding = {
  type: ProtectionType;
  activeFromMonth: number;
  monthlyPremium: number;
  source: 'existing' | 'purchased';
};

export type Debt = {
  id: string;
  label: string;
  principalRemaining: number;
  monthlyRate: number;
  monthlyPayment: number;
  remainingMonths: number;
  startPaymentMonth: number;
};

export type DebtTemplate = Omit<Debt, 'startPaymentMonth'> & { startPaymentMonth?: number };

export type CharacterProfile = {
  id: string;
  name: string;
  role: string;
  archetype: string;
  challenge: string;
  story: string;
  trait: string;
  baseIncome: number;
  incomeStability: IncomeStability;
  startingCash: number;
  startingInvestments: number;
  fixedExpenses: number;
  healthBenefitCap: number;
  dependents: number;
  hasCar: boolean;
  hasHome: boolean;
  existingProtections: Array<{ type: ProtectionType; monthlyPremium?: number }>;
  startingDebts: DebtTemplate[];
  goal: { label: string; targetNetPosition: number };
};

export type EventRequirements = {
  hasCar?: boolean;
  hasHome?: boolean;
  dependents?: boolean;
  investments?: boolean;
  missingProtection?: ProtectionType;
  stabilities?: IncomeStability[];
  minMonth?: number;
  maxMonth?: number;
};

export type EventEffect = {
  cashDelta?: number;
  investmentDelta?: number;
  investmentPercent?: number;
  incomeModifier?: {
    percent: number;
    months?: number;
    throughEnd?: boolean;
    label: string;
  };
  expenseModifier?: { amount: number; months: number; label: string };
  addProtection?: ProtectionType;
  debtPrincipalReduction?: number;
  borrow?: { principal: number; monthlyRate: number; termMonths: number; label: string };
  cost?: { amount: number; protectionType?: ProtectionType };
};

export type EventOption = {
  id: string;
  label: string;
  description?: string;
  outcomeText: string;
  effect: EventEffect;
};

export type MoneyEvent = {
  id: string;
  category: EventCategory;
  title: string;
  text: string;
  weight: number;
  sensitive?: boolean;
  repeat?: boolean;
  cooldown?: number;
  chainId?: string;
  requirements?: EventRequirements;
  options: EventOption[];
};

export type TemporaryModifier = {
  kind: 'income' | 'expense';
  amount: number;
  throughMonth: number;
  label: string;
};

export type MonthLedger = {
  month: number;
  income: number;
  fixedExpenses: number;
  protectionPremiums: number;
  debtPayments: number;
  temporaryExpenses: number;
  netBeforeEvent: number;
};

export type EventResolution = {
  eventId: string;
  optionId: string;
  summary: string;
  grossCost?: number;
  existingBenefit?: number;
  protectionBenefit?: number;
  outOfPocket?: number;
  protectionUsed?: ProtectionType;
};

export type HistoryEntry = {
  month: number;
  eventId: string;
  eventTitle: string;
  optionLabel: string;
  category: EventCategory;
  sensitive: boolean;
  summary: string;
};

export type PendingShortfall = {
  amount: number;
  resume: 'event' | 'month-end';
  usedActions?: RecoveryActionId[];
};

export type GameState = {
  seed: string;
  rngCursor: number;
  characterId: string;
  currentMonth: number;
  monthStarted: boolean;
  cash: number;
  investments: number;
  fixedExpenses: number;
  healthBenefitCap: number;
  protections: ProtectionHolding[];
  debts: Debt[];
  modifiers: TemporaryModifier[];
  usedEventIds: string[];
  recentCategories: EventCategory[];
  currentEventId?: string;
  pendingShortfall?: PendingShortfall;
  monthLedger?: MonthLedger;
  lastResolution?: EventResolution;
  history: HistoryEntry[];
  status: GameStatus;
  outcomeReason?: string;
};

export type StatusBars = {
  liquidity: number;
  flexibility: number;
  goal: number;
  goalProgressPercent: number;
  goalSegmentProgress: number;
  goalPreviousMilestonePercent: number;
  goalNextMilestonePercent: number;
  goalNextMilestoneAmount: number;
  goalRemainingToNext: number;
  liquidityLabel: string;
  flexibilityLabel: string;
  goalLabel: string;
  netPosition: number;
  projectedMonthlyFlexibility: number;
};

export type LoanQuote = {
  principal: number;
  monthlyPayment: number;
  monthlyRate: number;
  termMonths: number;
  canBorrow: boolean;
  partial: boolean;
  reason?: string;
};
